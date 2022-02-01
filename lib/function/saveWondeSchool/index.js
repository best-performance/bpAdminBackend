/**
 * The primary role of this lambda is to save data sourced from Wonde into
 * the dynamoDB databases of
 * This is the development version located in the sandbox account
 * It saves the data to locally created tables matching those in EdCompanion/Elastik
 * Here is the list of tables that we will add records to:
 *    -School
 *    -Student
 *    -User           - for both Teachers and Students
 *    -SchoolStudent
 *    -Classroom
 *    -ClassroomTeacher
 *    -ClassroomStudent
 *    -ClassroomLearningArea
 *    -ClassroomYearLevel
 *    -StudentData
 *
 * In addition we need to lookup data in the following tables
 *    Country       ( when saving the school)
 *    State         (when saving the school)
 *    LearningArea  (when saving the ClassroomLearningArea)
 *    YearLevel     (when saving the ClassroomYearLevel)
 * For convenience we have created these tables in the CDK and polulated them from csv files
 * This is a once off operation and is complete in sandbox
 */

const AWS = require("aws-sdk");
const { v4 } = require("uuid");
const { populateLookups } = require("loadLookups"); // this is run just once to populate the lookup tables
const { batchWrite } = require("helpers"); // bc helper fn

//Lookup tables
const COUNTRY_TABLE = "Country";
const STATE_TABLE = "State";
const LEARNINGAREA_TABLE = "LearningArea";
const YEARLEVEL_TABLE = "YearLevel";

// Tables to store school data
const SCHOOL_TABLE = "Schools";
const STUDENT_TABLE = "Student";
const USER_TABLE = "User";
const SCHOOL_STUDENT_TABLE = "SchoolStudent";
const CLASSROOM_TABLE = "Classroom";
const CLASSROOM_TEACHER_TABLE = "ClassroomTeacher";
const CLASSROOM_STUDENT_TABLE = "ClassroomStudent";
const CLASSROOM_YEARLEVEL_TABLE = "ClassroomYearLevel";
const CLASSROOM_LEARNING_AREA_TABLE = "ClassroomLearningArea";
const STUDENT_DATA_TABLE = "StudentData";

const SCHOOL_GSI_INDEX = "wondeIDIndex";

const BATCH_SIZE = 25; // max number of records for a docClient.batchWrite()

/** ----------------------------------------------------------------------- */
async function saveSchool(docClient, selectedSchool, countriesLookup) {
  //This puts and entry in table School if not already there

  // first check if the WondeID already exists (ie the school is already saved)
  const queryParams = {
    TableName: SCHOOL_TABLE,
    IndexName: SCHOOL_GSI_INDEX,
    KeyConditionExpression: "#wondeID = :wondeID",
    ExpressionAttributeNames: {
      "#wondeID": "wondeID",
    },
    ExpressionAttributeValues: {
      ":wondeID": selectedSchool.wondeID,
    },
  };
  try {
    let response = await docClient.query(queryParams).promise();
    //console.log("inside saveSchool response", response);
    if (response.Count > 0) {
      return {
        result: true,
        msg: "School already exists",
        schoolID: response.Items[0].id,
      };
    }
  } catch (err) {
    return { result: false, msg: err.message };
  }

  // Save the school since its not already in the database
  let schoolID = v4(); // random uuid generator
  // locate the EdCompanion countryID

  let country = countriesLookup.Items.find(
    (country) => country.name === selectedSchool.country
  );
  //console.log("Country:", country);
  const params = {
    TableName: SCHOOL_TABLE,
    Item: {
      id: schoolID, // this is the EdC id
      wondeID: selectedSchool.wondeID, // not in EdC
      schoolName: selectedSchool.schoolName,
      address: selectedSchool.address1, // not in EdC
      country: selectedSchool.country, // not in EdC
      countryID: country ? country.id : `${selectedSchool.country} not in list`, // not in Wonde
      stateID: `Wonde has no states`, // not in Wonde
      town: selectedSchool.town, // not in Wonde
      motto: `May the force be with the students of ${selectedSchool.schoolName}`, // not in Wonde
      studentLoginEnabed: false, // not in Wonde
      // other optional EdC fields not loaded
      // dummy:       String
      // ealdProgress:Boolean
      // logo:        S3Object
    },
  };
  try {
    await docClient.put(params).promise();
    return { result: true, meg: "School saved Ok", schoolID: schoolID };
  } catch (err) {
    return { result: false, msg: err.message };
  }
} // end of saveSchool

/** ----------------------------------------------------------------------- */
async function saveClassrooms(
  docClient,
  schoolID,
  classrooms, // a list of unique classrooms
  yearLevelsLoookup,
  learningAreasLookup
) {
  // This function
  //   - saves the uniqueClassroomList in table Classroom (88 records)
  //   - puts an entry in ClassroomYearLevel for each classroom (88 records)
  //   - puts an entry in ClassroomLearningArea for each classroom (88 records)

  // We generate a map of classroom id pairs. It is returned to enable
  // later parts of the uploader to translate a wondeID to an edCompanion ID
  let classroomMap = new Map();

  try {
    console.time("Saved Classrooms"); // measure how long it takes to save
    // we have an array of items to batchWrite() in batches of up BATCH_SIZE
    let batchesCount = parseInt(classrooms.length / BATCH_SIZE) + 1; // allow for remainder
    let lastBatchSize = classrooms.length % BATCH_SIZE; // which could be 0
    // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    //console.log("batchesCount", batchesCount);
    //console.log("lastBatchSize", lastBatchSize);

    // process each batch
    let index = 0; //index in the classrooms array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE;
      if (batchSize === 0) break; // must have been an even no of batches

      let batchToWrite = [];
      for (let n = 0; n < batchSize; n++) {
        let id = v4();
        batchToWrite.push({
          PutRequest: {
            Item: {
              id: id, // this is the EdC id generated locally
              classType: "Classroom",
              // focusGroupType: null, // its not a focus group
              className: classrooms[index].classroomName,
              schoolYear: "2022", // hardcoded for now
              schoolID: schoolID, // not in Wonde - generated above when saving the school
              wondeClassroomId: classrooms[index].wondeClassroomId, // not in EdC
              mis_id: classrooms[index].mis_id, // not in EdC
            },
          },
        });
        classroomMap.set(classrooms[index].wondeClassroomId, id); // a goodie to return only
        classrooms[index].classroomID = id; // save the ID for the LearningArea and YearLevel tables
        index++;
      } // end batch loop

      //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
      let response = await batchWrite(batchToWrite, CLASSROOM_TABLE, docClient);
      //console.log(response);

      if (!response.result) {
        console.log(`exiting at index ${index}`);
        break;
      }
    } // end array loop
    console.timeEnd("Saved Classrooms");
  } catch (err) {
    console.log(err);
    return { result: false, msg: err.message }; // abandon ship
  } // end saving classrooms

  // Classrooms saves - next save classroomYearLevels
  console.log("saving ClassroomYearLevels");
  try {
    console.time("Saved ClassroomYearLevels"); // measure how long it takes to save
    // we have an array of items to batchWrite() in batches of up BATCH_SIZE
    let batchesCount = parseInt(classrooms.length / BATCH_SIZE) + 1; // allow for remainder
    let lastBatchSize = classrooms.length % BATCH_SIZE; // which could be 0
    // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    //console.log("batchesCount", batchesCount);
    //console.log("lastBatchSize", lastBatchSize);

    // process each batch
    let index = 0; //index in the classrooms array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE;
      if (batchSize === 0) break; // must have been an even no of batches

      let batchToWrite = [];
      for (let n = 0; n < batchSize; n++) {
        // lookup the yearLevelID to save
        let yearLevelRecord = yearLevelsLoookup.find(
          (o) => o.yearCode === `Y${classrooms[index].yearLevel}`
        );
        //console.log("yearLevelRecord", yearLevelRecord);
        batchToWrite.push({
          PutRequest: {
            Item: {
              id: v4(), // this is the EdC id generated locally
              classroomID: classrooms[index].classroomID,
              schoolID: schoolID, // not in Wonde - generated above when saving the school
              yearLevelID: yearLevelRecord.id,
            },
          },
        });
        index++;
      } // end batch loop

      //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
      let response = await batchWrite(
        batchToWrite,
        CLASSROOM_YEARLEVEL_TABLE,
        docClient
      );
      //console.log(response);

      if (!response.result) {
        console.log(`exiting at index ${index}`);
        break;
      }
    } // end array loop
    console.timeEnd("Saved ClassroomYearLevels");
  } catch (err) {
    console.log(err);
    return { result: false, msg: err.message }; // abandon ship
  } // end save classrommYearLevel

  // ClassroomYearLevel saved so we can now do the ClassroomLearningArea
  // NB: For now assuming one learningArea per class
  console.log("saving ClassroomLearningArea");
  try {
    console.time("Saved ClassroomLearningArea"); // measure how long it takes to save
    // we have an array of items to batchWrite() in batches of up BATCH_SIZE
    let batchesCount = parseInt(classrooms.length / BATCH_SIZE) + 1; // allow for remainder
    let lastBatchSize = classrooms.length % BATCH_SIZE; // which could be 0
    // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    //console.log("batchesCount", batchesCount);
    //console.log("lastBatchSize", lastBatchSize);

    // process each batch
    let index = 0; //index in the classrooms array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE;
      if (batchSize === 0) break; // must have been an even no of batches

      let batchToWrite = [];
      for (let n = 0; n < batchSize; n++) {
        // lookup the yearLevelID to save
        let learningAreaRecord = learningAreasLookup.find(
          (o) => o.areaName === classrooms[index].classroomLearningArea
        );
        //console.log("learningAreaRecord", learningAreaRecord);
        batchToWrite.push({
          PutRequest: {
            Item: {
              id: v4(), // this is the EdC id generated locally
              classroomID: classrooms[index].classroomID,
              learningAreaID: learningAreaRecord.id,
            },
          },
        });
        index++;
      } // end batch loop

      //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
      let response = await batchWrite(
        batchToWrite,
        CLASSROOM_LEARNING_AREA_TABLE,
        docClient
      );
      //console.log(response);

      if (!response.result) {
        console.log(`exiting at index ${index}`);
        break;
      }
    } // end array loop
    console.timeEnd("Saved ClassroomLearningArea");
  } catch (err) {
    console.log(err);
    return { result: false, msg: err.message }; // abandon ship
  } // end save classroomYearLevels

  return { result: true, msg: "saved classrooms", classroomMap };
} // end saveClassrooms()

/** ----------------------------------------------------------------------- */
async function saveTeachers(
  docClient,
  schoolID,
  teacherList,
  teacherClassroomList,
  classroomMap
) {
  // This saves the teachers in table User
  // It also puts an entry in ClassroomTeacher for each classroom taught by each teacher
  // It also creates an entry in Cognito in the Users group for each teacher
  try {
    console.time("Saved Teachers"); // measure how long it takes to save
    // we have an array of items to batchWrite() in batches of up BATCH_SIZE
    let batchesCount = parseInt(teacherList.length / BATCH_SIZE) + 1; // allow for remainder
    let lastBatchSize = teacherList.length % BATCH_SIZE; // which could be 0
    // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    console.log("teachers batchesCount", batchesCount);
    console.log("teachers lastBatchSize", lastBatchSize);

    // process each batch
    let index = 0; //index in the teacherList array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE;
      if (batchSize === 0) break; // must have been an even no of batches

      let batchToWrite = [];
      for (let n = 0; n < batchSize; n++) {
        let id = v4();
        // patch the email if missing (often missing in Wonde)
        if (!teacherList[index].email) {
          teacherList[index].email = `${id}@placeholder.com`;
        }
        batchToWrite.push({
          PutRequest: {
            Item: {
              userID: id, // this is the EdC id generated locally
              firstName: teacherList[index].firstName,
              lastName: teacherList[index].lastName,
              email: teacherList[index].email,
              userGroup: "User",
              UserType: "Educator",
              lastSignIn: "",
              dbType: "User",
              userSchoolID: schoolID, // not in Wonde - generated above when saving the school
              wondeTeacherId: teacherList[index].wondeTeacherId, // not in EdC
              mis_id: teacherList[index].mis_id, // not in EdC
            },
          },
        });
        teacherList[index].userID = id; // save the ID for the ClassroomTeachers tables
        index++;
      } // end batch loop

      //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
      let response = await batchWrite(batchToWrite, USER_TABLE, docClient);
      //console.log(response);

      if (!response.result) {
        console.log(`exiting at index ${index}`);
        break;
      }
    } // end array loop
    console.timeEnd("Saved Teachers");
  } catch (err) {
    console.log(err);
    return { result: false, msg: err.message }; // abandon ship
  } // end saving teachers

  // Now save classroomTeachers
  // for every classroom in teacherClassroomList, put one record in classroomTeachers
  try {
    console.time("Saved classroomTeachers"); // measure how long it takes to save
    // we have an array of items to batchWrite() in batches of up BATCH_SIZE
    let batchesCount = parseInt(teacherClassroomList.length / BATCH_SIZE) + 1; // allow for remainder
    let lastBatchSize = teacherClassroomList.length % BATCH_SIZE; // which could be 0
    // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    console.log("classroomTeachers batchesCount", batchesCount);
    console.log("classroomTeachers lastBatchSize", lastBatchSize);

    // process each batch
    let index = 0; //index in the teacherList array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE;
      if (batchSize === 0) break; // must have been an even no of batches
      // lookup the email from the wondeTeacherID
      let emailRecord = teacherList.find(
        (o) => o.wondeTeacherId === teacherClassroomList[index].wondeTeacherId
      );
      //console.log("emailRecord", emailRecord);
      let batchToWrite = [];
      for (let n = 0; n < batchSize; n++) {
        let id = v4();
        let classroomID = classroomMap.get(
          teacherClassroomList[index].wondeClassroomId
        );
        if (index === 10) console.log("classroomID", classroomID);
        batchToWrite.push({
          PutRequest: {
            Item: {
              id: id, // this is the EdC id generated locally
              classroomID: classroomID ? classroomID : "missing",
              email: emailRecord.email, // looked up from
            },
          },
        });
        index++;
      } // end batch loop

      //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
      let response = await batchWrite(
        batchToWrite,
        CLASSROOM_TEACHER_TABLE,
        docClient
      );
      //console.log(response);

      if (!response.result) {
        console.log(`exiting at index ${index}`);
        break;
      }
    } // end array loop
    console.timeEnd("Saved classroomTeachers");
  } catch (err) {
    console.log(err);
    return { result: false, msg: err.message }; // abandon ship
  } // end saving classroomTeachers

  return { result: true, msg: "saved Teachers" };
}
/** ----------------------------------------------------------------------- */
async function saveStudents(
  docClient,
  schoolID,
  studentList,
  studentClassroomList,
  yearLevelsLoookup,
  classroomMap
) {
  // This saves the students in table Student
  // its also saves the students in table Users (conditionally?)
  // it also puts and entry in SchoolStudent
  // It also puts and entry in ClassroomStudent for each classroom that each student attends
  // It also updates studentData if needed (we dont have this table yet)
  try {
    console.time("Saved Students"); // measure how long it takes to save
    // we have an array of items to batchWrite() in batches of up BATCH_SIZE
    let batchesCount = parseInt(studentList.length / BATCH_SIZE) + 1; // allow for remainder
    let lastBatchSize = studentList.length % BATCH_SIZE; // which could be 0
    // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    console.log("Students batchesCount", batchesCount);
    console.log("Students lastBatchSize", lastBatchSize);

    // process each batch
    let index = 0; //index in the studentList array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE;
      if (batchSize === 0) break; // must have been an even no of batches

      let batchToWrite = [];
      for (let n = 0; n < batchSize; n++) {
        // lookup the yearLevelID to save
        let yearLevelRecord = yearLevelsLoookup.find(
          (o) => o.yearCode === `Y${studentList[index].year}`
        );
        //console.log("yearLevelRecord", yearLevelRecord);
        let id = v4();
        batchToWrite.push({
          PutRequest: {
            Item: {
              id: id, // this is the EdC id generated locally
              fistName: studentList[index].firstName,
              lastName: studentList[index].lastName,
              gender: studentList[index].gender,
              birthDate: studentList[index].dob,
              yearLevelID: yearLevelRecord.id, // the lookup value
              userSchoolID: schoolID, // not in Wonde - generated above when saving the school
              wondeStudentId: studentList[index].wondeStudentId, // not in EdC
              mis_id: studentList[index].mis_id, // not in EdC
            },
          },
        });
        studentList[index].studentID = id; // save the ID for tables below
        index++;
      } // end batch loop

      // console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
      let response = await batchWrite(batchToWrite, STUDENT_TABLE, docClient);
      //console.log(response);

      if (!response.result) {
        console.log(`exiting at index ${index}`);
        break;
      }
    } // end array loop
    console.timeEnd("Saved Students");
  } catch (err) {
    console.log(err);
    return { result: false, msg: err.message }; // abandon ship
  } // end saving students

  // Now save schoolStudents
  // for every student one record in table SchoolStudent
  try {
    console.time("Saved SchoolStudents"); // measure how long it takes to save
    // we have an array of items to batchWrite() in batches of up BATCH_SIZE
    let batchesCount = parseInt(studentList.length / BATCH_SIZE) + 1; // allow for remainder
    let lastBatchSize = studentList.length % BATCH_SIZE; // which could be 0
    // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    console.log("SchoolStudents batchesCount", batchesCount);
    console.log("SchoolStudents lastBatchSize", lastBatchSize);

    // process each batch
    let index = 0; //index in the studentList array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE;
      if (batchSize === 0) break; // must have been an even no of batches

      let batchToWrite = [];
      for (let n = 0; n < batchSize; n++) {
        // lookup the yearLevelID to save
        let yearLevelRecord = yearLevelsLoookup.find(
          (o) => o.yearCode === `Y${studentList[index].year}`
        );
        //console.log("yearLevelRecord", yearLevelRecord);
        let id = v4();
        batchToWrite.push({
          PutRequest: {
            Item: {
              id: id, // this is the EdC id generated locally
              schoolID: schoolID,
              studentID: studentList[index].studentID,
              yearLevelID: yearLevelRecord.id, // the lookup value
              fistName: studentList[index].firstName,
              lastName: studentList[index].lastName,
              userID: "", // will be filled when student gets a login (its id not email!)
            },
          },
        });
        index++;
      } // end batch loop

      //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
      let response = await batchWrite(
        batchToWrite,
        SCHOOL_STUDENT_TABLE,
        docClient
      );
      //console.log(response);

      if (!response.result) {
        console.log(`exiting at index ${index}`);
        break;
      }
    } // end array loop
    console.timeEnd("Saved SchoolStudents");
  } catch (err) {
    console.log(err);
    return { result: false, msg: err.message }; // abandon ship
  } // end saving schoolStudents

  // Now save ClassroomStudent
  // for every record in studentClassroomList, add one record to table ClassroomStudent
  // We start with 2 Wonde ids that needs to be translated to EdCompanion IDs
  //    wondeStudentID: "B1070408366" - find the corresponding EdCompanion studentID
  //    wondeClassroomId: "B1197167074" - find teh corresponding EdCompanion clasroomID
  try {
    console.time("Saved classroomStudent"); // measure how long it takes to save
    // we have an array of items to batchWrite() in batches of up BATCH_SIZE
    let batchesCount = parseInt(studentClassroomList.length / BATCH_SIZE) + 1; // allow for remainder
    let lastBatchSize = studentClassroomList.length % BATCH_SIZE; // which could be 0
    // eg is 88 records thats 4 batches with lastBatch size 13 (3x25+13 = 88)

    console.log("classroomStudent batchesCount", batchesCount);
    console.log("classroomStudent lastBatchSize", lastBatchSize);

    // process each batch
    let index = 0; //index in the studentList array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = batchesCount === i + 1 ? lastBatchSize : BATCH_SIZE;
      if (batchSize === 0) break; // must have been an even no of batches

      let batchToWrite = [];
      for (let n = 0; n < batchSize; n++) {
        // lookup the yearLevelID to save
        let studentIDRecord = studentList.find(
          (o) => o.wondeStudentId === studentClassroomList[index].wondeStudentId
        );
        let id = v4();
        let classroomID = classroomMap.get(
          studentClassroomList[index].wondeClassroomId
        );
        batchToWrite.push({
          PutRequest: {
            Item: {
              id: id, // this is the EdC id generated locally
              classroomID: classroomID ? classroomID : "missing",
              studentID:
                studentIDRecord && studentIDRecord.studentID
                  ? studentIDRecord.studentID
                  : "missing",
            },
          },
        });
        index++;
      } // end batch loop

      //console.log(`writing batch ${i} batchsize ${batchToWrite.length}`);
      let response = await batchWrite(
        batchToWrite,
        CLASSROOM_STUDENT_TABLE,
        docClient
      );
      //console.log(response);

      if (!response.result) {
        console.log(`exiting at index ${index}`);
        break;
      }
    } // end array loop
    console.timeEnd("Saved classroomStudent");
  } catch (err) {
    console.log(err);
    return { result: false, msg: err.message }; // abandon ship
  } // end saving classroomStudent

  return { result: true, msg: "saved Students" };
}
/** ----------------------------------------------------------------------- */

exports.handler = async function (event) {
  // response should be an array of objects - one per school

  // NB Populating lookup tables not needed when we move out of sandbox account
  // NB These tables only need to be populated once
  // If you need to run it for one of more tables then..
  // go into loadLookups.js and makes sure each table is included
  // uncomment below to run the populate.
  // let response = await populateLookups();
  // if (!response) {
  //   return {
  //     statusCode: 500,
  //     headers: { "Access-Control-Allow-Origin": "*" },
  //     error: response.msg,
  //   };
  // }

  let response = {};
  const body = JSON.parse(event.body); // see below for format of each data array

  // destructure the data into separate structure - {} and 3 x []
  ({
    selectedSchool,
    studentList,
    teacherList,
    teacherClassroomList,
    studentClassroomList,
    uniqueClassroomList,
  } = body);

  const docClient = new AWS.DynamoDB.DocumentClient();

  // These need to be sequential because ids and the like are generated
  // that are needed by the next step

  // globals to store the lookups - school independent data
  let countriesLookup = [];
  let statesLookup = [];
  let learningAreasLookup = [];
  let yearLevelsLoookup = [];

  // read the lookup tables and bail if fails
  try {
    let response;
    response = await docClient.scan({ TableName: COUNTRY_TABLE }).promise();
    countriesLookup = response.Items;
    console.log("countriesLookup", countriesLookup);
    response = await docClient.scan({ TableName: STATE_TABLE }).promise();
    statesLookup = response.Items;
    response = await docClient
      .scan({ TableName: LEARNINGAREA_TABLE })
      .promise();
    learningAreasLookup = response.Items;
    response = await docClient.scan({ TableName: YEARLEVEL_TABLE }).promise();
    yearLevelsLoookup = response.Items;
  } catch (error) {
    console.log(err.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      error: error,
    };
  }

  // save the school and bail if it already exists or fails
  // returns the schoolID both if new or existing
  response = await saveSchool(docClient, selectedSchool, countriesLookup);
  if (response.result === false) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      error: response.msg,
    };
  }
  // schoolID is the uuid generated by saveSchool()
  console.log("saveSchool response", response);
  let schoolID = response.schoolID; // needed for saveClassrooms etc

  // NO NOT DELETE
  //save the classrooms and bail if fails
  let classroomMap = false;
  response = await saveClassrooms(
    docClient,
    schoolID,
    uniqueClassroomList,
    yearLevelsLoookup,
    learningAreasLookup
  );
  if (response.result === false) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      error: response.msg,
    };
  }
  if (response.classroomMap) {
    classroomMap = response.classroomMap;
  }
  console.log(classroomMap);

  //save the Teacher(s) and bail if fails
  response = await saveTeachers(
    docClient,
    schoolID,
    teacherList, // see below for format
    teacherClassroomList,
    classroomMap
  );
  if (response.result === false) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      error: response.msg,
    };
  }

  // save the Students(s) and bail if fails
  response = await saveStudents(
    docClient,
    schoolID,
    studentList,
    studentClassroomList,
    yearLevelsLoookup,
    classroomMap
  );
  if (response.result === false) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      error: response.msg,
    };
  }

  // reach here are we are all good
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: response.body,
  };
};
//Format of lambda body

// selectedSchool: {
//   wondeSchoolID: 'A5960542',
//   schoolName: 'Wonde ANZ Testing School',
//   urn: 999939,
//   address1: '1 George St',
//   address2: null,
//   town: 'Sydney',
//   country: 'Australia'
// },
// studentList: [
//   {
//     wondeStudentId: 'B712005510',
//     mis_id: '11186',
//     firstName: 'Rhyett',
//     lastName: 'Burrell',
//     gender: 'MALE',
//     dob: '20 Jul 2015',
//     year: '1'
//   },
// ]
// teacherList: [
//   {
//     wondeTeacherId: 417678060'B',
//     mis_id: '2373737',
//     title: 'Ms',
//     firstName: 'Lab60',
//     lastName: 'Sixty',
//     email: 'home_13717@emailaddress.com.au'
//   },
// ]
// teacherClassroomList:[
//   {
//      wondeTeacherId: "B417678060"
//      wondeClassroomId: "B880791327"
//   }
// ]
// studentClassroomList:[
//   {
//      wondeStudentId: "B1070408366"
//      wondeClassroomId: "B1197167074"
//   }
// ]
// uniqueClassroomList:[
//   {
//     wondeClassroomId: "B1595102003"
//     mis_id: "ae4fb60a2672f5555cd8b439e487c9a1"
//     classroomLearningArea: "English"
//     classroomName: "English 09"
//     yearLevel: "9"
//   }
// ]
//
// format of lookups ...................................
//console.log("Countries:", countries);
// Items: [
//   {
//     __typename: 'Country',
//     updateAt: '2020-10-01T02:20:00.052Z',
//     countryCode: 'AU',
//     createdAt: '2020-10-01T02:20:00.052Z',
//     id: '11c23bd3-da6d-4529-b009-ada63d12ca11',
//     name: 'Australia'
//   }
//console.log("States:", states);
// Items: [
//   {
//     __typename: 'State',
//     stateCode: 'SA',
//     updateAt: '2021-06-10T03:39:47.947Z',
//     createdAt: '2021-06-10T03:39:47.947Z',
//     countryID: '11c23bd3-da6d-4529-b009-ada63d12ca11',
//     id: '6ad01a2a-4e9c-4aff-a9bd-530e80bce3cf',
//     name: 'South Australia'
//   },
//console.log("LearningAreas:", learningAreas);
// Items: [
//   {
//     updateAt: '2021-01-22T01:48:11.100Z',
//     createdAt: '2020-09-27T07:48:48.275Z',
//     colour: '#ee4491',
//     areaName: 'English',
//     id: '5517a431-48ab-4918-a725-f536bd013531',
//     __typeName: 'LearningArea'
//   },
//console.log("YearLevels:", yearLevels);
// Items: [
//   {
//     updateAt: '2020-09-27T08:03:40.164Z',
//     createdAt: '2020-09-27T08:03:40.164Z',
//     description: 'Year 6',
//     id: '61bbb147-07ba-40d6-bc6f-4f6bd9a29113',
//     __typeName: 'YearLevel',
//     yearCode: 'Y6',
//     type: 'YL'
//   },
