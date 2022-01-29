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

// save the selected Wonde school if it does not exist already
async function saveWondeSchoolData(
  docClient,
  selectedSchool,
  studentList,
  teacherList
) {
  console.log("inside saveWondeSchool");

  //Save the Students to Students table
  // console.time("Students");
  // await Promise.all(
  //   studentList.map(async (student) => {
  //     // find the EdC yearLevelID from the yearLevel Lookup
  //     let yearLevel = yearLevels.Items.find((yLevel) => yLevel.yearCode === `Y${student.year}`);
  //     const params = {
  //       TableName: STUDENT_TABLE_NAME,
  //       Item: {
  //         id: v4(), // this is the EdC id
  //         wondeID: student.id, // not in EdC
  //         mis_id: student.mis_id, // not in EdC
  //         firstName: student.firstName,
  //         lastName: student.lastName,
  //         gender: student.gender, // enum MALE|FEMALE
  //         dob: student.dob,
  //         year: student.year, // not in EdC
  //         yearLevelID: yearLevel.id,
  //       },
  //     };
  //     return await docClient.put(params).promise();
  //   })
  // );
  // console.timeEnd("Students");

  //Save the Teachers to Users table
  //   console.time("Teachers");
  //   await Promise.all(
  //     teacherList.map(async (teacher) => {
  //       const params = {
  //         TableName: USER_TABLE_NAME,
  //         Item: {
  //           userID: v4(), // not in Wonde - EdC id generated locally
  //           wondeID: teacher.id, // not in EdC
  //           firstName: teacher.firstName,
  //           lastName: teacher.lastName,
  //           email: teacher.email ? teacher.email : "dummy@notsupplied.com",
  //           userGroup: "Users", // not in Wonde
  //           userType: "Educator", //  not in Wonde
  //           userSchoolID: schoolID, // not in Wonde - generated above when saving the school
  //         },
  //       };
  //       return await docClient.put(params).promise();
  //     })
  //   );
  //   console.timeEnd("Teachers");

  return { body: `Successfully saved data for ${selectedSchool.schoolName}!` };
} // end of saveWondeSchool

/** ----------------------------------------------------------------------- */
async function readlookups(docClient) {
  try {
    countries = await docClient.scan({ TableName: COUNTRY_TABLE }).promise();

    states = await docClient.scan({ TableName: STATE_TABLE }).promise();

    learningAreas = await docClient
      .scan({ TableName: LEARNINGAREA_TABLE })
      .promise();

    yearLevels = await docClient.scan({ TableName: YEARLEVEL_TABLE }).promise();

    return { result: true, msg: "Lookups read OK" };
  } catch (err) {
    let msg = "Error reading lookups";
    console.log(msg);
    return { result: false, msg };
  }
}

/** ----------------------------------------------------------------------- */
async function saveSchool(docClient, selectedSchool) {
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
    if (response.Count > 0) {
      console.log(response);
      return { result: true, msg: "School already exists", schoolID: 0 }; // we have not saved a school ( becasue already exists)
    }
  } catch (err) {
    return { result: false, msg: err.message };
  }

  // Save the school since its not already in the database
  let schoolID = v4(); // random uuid generator
  // locate the EdCompanion countryID
  let country = countries.Items.find(
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
async function saveClassrooms(classrooms, schoolID, docClient) {
  // This saves the classrooms in table Classroom
  // it also puts an entry in ClassroomYearLevel for each classroom
  // it also puts an entry in ClassroomLearningArea for each classroom

  // we have an array of items to batchWrite() in batches of up BATCH_SIZE
  try {
    console.time("Saved Classrooms");
    // Find no of batches needed
    let batchesCount = parseInt(classrooms.length / BATCH_SIZE) + 1; // allow for remainder
    let lastBatchSize = classrooms.length % BATCH_SIZE; // which could be 0

    // process each batch
    let index = 0; //index in the classrooms array
    for (let i = 0; i < batchesCount; i++) {
      let batchSize = (batchesCount = i + 1) ? lastBatchSize : BATCH_SIZE;
      if (batchSize === 0) break; // must have been an even no of batches

      let batchToWrite = [];
      for (let n = 0; n < batchSize; n++) {
        batchToWrite.push({
          PutRequest: {
            Item: {
              id: v4(), // this is the EdC id generated locally
              classType: "Classroom",
              focusGroupType: null, // its not a focus group
              className: classrooms[index].className,
              schoolYear: classrooms[index].schoolYear, // like 2022 mandatory
              schoolID: schoolID, // not in Wonde - generated above when saving the school
              wondeID: classrooms[index].id, // not in EdC
              mis_id: classrooms[index].mis_id, // not in EdC
            },
          },
        });
        index++;
      } // end batch loop
      let response = await batchWrite(batchToWrite, CLASSROOM_TABLE, docClient);
      if (!response.result) {
        console.log(`exiting at index ${index}`);
        break;
      }
    } // end array loop
    console.timeEnd("Saved Classrooms");
  } catch (err) {
    console.log(error);
    return { result: false, meg: "Failed to save Classrooms" }; // abandon ship
  }

  return { result: true, meg: "saved classrooms" };
  // Classroooms saved so we can now do the ClassroomYearLevel
  // Note we dont have a year-level provided by Wonde but we can infer it from the className
  //
}

/** ----------------------------------------------------------------------- */
async function saveTeachers() {
  // This saves the teachers in table User
  // It also creates an entry in Cognito in the Users group for each teacher
  // It also puts an entry in ClassroomTeacher for each classroom taught by each teacher
}
/** ----------------------------------------------------------------------- */
async function saveStudents() {
  // This saves the students in table Student
  // it also puts and entry in SchoolStudent
  // It also puts and entry in ClassroomStudent for each classroom that each student attends
  // It also updated studentData if needed
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
  ({ selectedSchool, studentList, teacherList, classroomList } = body);

  const docClient = new AWS.DynamoDB.DocumentClient();

  // These need to be sequential because ids and the like are generated
  // that are needed by the next step

  // globals to store the lookups - school independent data
  let countries = [];
  let states = [];
  let learningAreas = [];
  let yearLevels = [];

  // save the school and bail if it already exists or fails
  response = await saveSchool(docClient, selectedSchool);
  if (response.result === false) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      error: response.msg,
    };
  }
  // schoolID is the uuid generated by saveSchool()
  let schoolID = response.schoolID; // needed for saveClassrooms etc

  // read the lookup tables and bail if fails
  response = await readlookups(docCient);
  if (response.result === false) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      error: response.msg,
    };
  }

  //save the classrooms and bail if fails
  response = await saveClassrooms(
    docClient,
    classroomList // see below for format
  );
  if (response.result === false) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      error: response.msg,
    };
  }

  // save the Teacher(s) and bail if fails
  // response = await saveTeachers(
  //   docClient,
  //   body.teacherList // see below for format
  // );
  // if (response.result === false) {
  //   return {
  //     statusCode: 500,
  //     headers: { "Access-Control-Allow-Origin": "*" },
  //     error: response.msg,
  //   };
  // }
  //
  // // save the Students(s) and bail if fails
  // response = await saveStudents(
  //   docClient,
  //   body.studentList // see below for format
  // );
  // if (response.result === false) {
  //   return {
  //     statusCode: 500,
  //     headers: { "Access-Control-Allow-Origin": "*" },
  //     error: response.msg,
  //   };
  // }
  //
  // reach here are we are all good
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: response.body,
  };
};
//Format of lambda body

// selectedSchool: {
//   wondeID: 'A5960542',
//   schoolName: 'Wonde ANZ Testing School',
//   urn: 999939,
//   address1: '1 George St',
//   address2: null,
//   town: 'Sydney',
//   country: 'Australia'
// },
// studentList: [
//   {
//     id: 'B712005510',
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
//     id: 417678060'B',
//     title: 'Ms',
//     firstName: 'Lab60',
//     lastName: 'Sixty',
//     email: 'home_13717@emailaddress.com.au'
//   },
// ]
// classroomList:[
//   {
//     studentID: student.id,
//     mis_id: classroom.mis_id,
//     classId: classroom.id,
//     className: classroom.name,
//     yearLevel: student.year.data.code, // we will need to know class year levels later
//     teacherId:'some ID',               // probably only teacher data needed
//     teacherFirstName:'some name'
//     teacherLastName:'some name"
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
