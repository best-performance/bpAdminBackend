const AWS = require("aws-sdk");
const { parse } = require("csv-parse/sync"); // to parse csv files
const fsp = require("fs").promises; // basic file reading - no install needed
const { v4 } = require("uuid");

const SCHOOL_TABLE_NAME = "Schools";
const SCHOOL_GSI_INDEX_NAME = "wondeIDIndex";
const STUDENT_TABLE_NAME = "Student";
const USER_TABLE_NAME = "User";
const CLASSROOM_TABLE_NAME = "Classroom";

const COUNTRY_TABLE_NAME = "Country";
const STATE_TABLE_NAME = "State";
const LEARNINGAREA_TABLE_NAME = "LearningArea";
const YEARLEVEL_TABLE_NAME = "YearLevel";
const LOOKUPS_ALREADY_READ = false; // its a once off operation
const lookupTables = ["Country.csv", "State.csv", "LearningArea.csv", "YearLevel.csv"];

// save the selected Wonde school if it does not exist already
async function saveWondeSchool(
  docClient,
  selectedSchool,
  studentList,
  teacherList,
  uniqueClassroomList
) {
  console.log("inside saveWondeSchool");

  // first check if the WondeID already exists (ie the school is already saved)
  const queryParams = {
    TableName: SCHOOL_TABLE_NAME,
    IndexName: SCHOOL_GSI_INDEX_NAME,
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
    //console.log("query Response", response);
    if (response.Count > 0) {
      // the record already exists
      return {
        body: `School with WondeID = ${selectedSchool.wondeID} already exists - records not saved`,
      };
    }
  } catch (err) {
    return { error: err };
  }

  // Only reach here if we are going to load a new schools data

  // Scan all the lookup tables becasue we need "id" references
  // Country, State, LearningArea, YearLevel
  let countries = [];
  let states = [];
  let learningAreas = [];
  let yearLevels = [];
  try {
    countries = await docClient.scan({ TableName: COUNTRY_TABLE_NAME }).promise();
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
    states = await docClient.scan({ TableName: STATE_TABLE_NAME }).promise();
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
    learningAreas = await docClient.scan({ TableName: LEARNINGAREA_TABLE_NAME }).promise();
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
    yearLevels = await docClient.scan({ TableName: YEARLEVEL_TABLE_NAME }).promise();
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
  } catch (err) {
    console.log(err);
    return { error: err };
  }

  // Save the school
  let schoolID = v4(); // random uuid generator
  // locate the EdCompanion countryID
  let country = countries.Items.find((country) => country.name === selectedSchool.country);
  //console.log("Country:", country);
  const params = {
    TableName: SCHOOL_TABLE_NAME,
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
  } catch (err) {
    return { error: err };
  }

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

  //Save the Classrooms to Classrooms table
  console.time("Classrooms");
  await Promise.all(
    uniqueClassroomList.map(async (classroom) => {
      const params = {
        TableName: CLASSROOM_TABLE_NAME,
        Item: {
          id: v4(), // this is the EdC id generated locally
          wondeID: classroom.id, // not in EdC
          classType: "Classroom",
          mis_id: classroom.mis_id, // not in EdC
          className: classroom.className,
          schoolID: schoolID, // not in Wonde - generated above when saving the school
        },
      };
      return await docClient.put(params).promise();
    })
  );
  console.timeEnd("Classrooms");

  return { body: `Successfully saved data for ${selectedSchool.schoolName}!` };
} // end of saveWondeSchool

exports.handler = async function (event) {
  // response should be an array of objects - one per school
  const body = JSON.parse(event.body);
  //console.log("event", body);
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
  // teacherList: [
  //   {
  //     id: 'B417678060',
  //     title: 'Ms',
  //     firstName: 'Lab60',
  //     lastName: 'Sixty',
  //     email: 'home_13717@emailaddress.com.au'
  //   },
  // uniqueClassroomList: [
  //   {
  //     id: 'B925278943',
  //     mis_id: 'fa83034af6be71feef1ec21a6b4f56fa',
  //     className: 'Drama 09',
  //     schoolYear: '9'
  // },

  const docClient = new AWS.DynamoDB.DocumentClient();
  let response = await saveWondeSchool(
    docClient,
    body.selectedSchool,
    body.studentList,
    body.teacherList,
    body.uniqueClassroomList
  );
  console.log(body.uniqueClassroomList);
  if (response.error) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      error: response.error,
    };
  }
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: response.body,
  };
};
// ARCHIVED CODE
// Code to populate the 4 lookup tables (once off operation)
// read in an populate the lookup tables ( from edCompanion prod) if not already done
// if (!LOOKUPS_ALREADY_READ) {
//   console.log("starting saving lookups");

//   csvData = await fsp.readFile(lookupTables[3]); // read the YearLevel csv
//   parsedData = parse(csvData, { columns: true }); // parse to array of objects
//   console.log("parsed YearLevel:", parsedData.length, parsedData[0]);
//   await Promise.all(
//     parsedData.map(async (item, index) => {
//       // save to table
//       const params = {
//         TableName: YEARLEVEL_TABLE_NAME,
//         Item: {
//           id: item.id,
//           __typeName: item.__typename,
//           createdAt: item.createdAt,
//           updateAt: item.updatedAt,
//           description: item.description,
//           type: item.type,
//           yearCode: item.yearCode,
//         },
//       };
//       return await docClient.put(params).promise();
//     })
//   );
// console.log(`Lookup table ${lookupTables[3]} saved`);

// let csvData = await fsp.readFile(lookupTables[0]); // read the Country csv
// let parsedData = parse(csvData, { columns: true }); // parse to array of objects
// console.log("country:", parsedData);

// const params = {
//   TableName: COUNTRY_TABLE_NAME,
//   Item: {
//     id: parsedData[0].id,
//     __typename: parsedData[0].__typename,
//     createdAt: parsedData[0].createdAt,
//     updateAt: parsedData[0].updatedAt,
//     countryCode: parsedData[0].countryCode,
//     name: parsedData[0].name,
//   },
// };
// await docClient.put(params).promise();

//   console.log(`Lookup table ${lookupTables[0]} saved`);

// csvData = await fsp.readFile(lookupTables[1]); // read the State csv
// parsedData = parse(csvData, { columns: true }); // parse to array of objects
// console.log("States:", parsedData);
// await Promise.all(
//   parsedData.map(async (item) => {
//     // save to table
//     const params = {
//       TableName: STATE_TABLE_NAME,
//       Item: {
//         id: item.id,
//         __typename: item.__typename,
//         createdAt: item.createdAt,
//         updateAt: item.updatedAt,
//         countryID: item.countryID,
//         stateCode: item.stateCode,
//         name: item.name,
//       },
//     };
//     return await docClient.put(params).promise();
//   })
// );
// console.log(`Lookup table ${lookupTables[1]} saved`);

// csvData = await fsp.readFile(lookupTables[2]); // read the LearningArea csv
// parsedData = parse(csvData, { columns: true }); // parse to array of objects
// console.log("LearningAreas:", parsedData);
// await Promise.all(
//   parsedData.map(async (item) => {
//     // save to table
//     const params = {
//       TableName: LEARNINGAREA_TABLE_NAME,
//       Item: {
//         id: item.id,
//         __typeName: item.__typename,
//         createdAt: item.createdAt,
//         updateAt: item.updatedAt,
//         areaName: item.areaName,
//         colour: item.colour,
//       },
//     };
//     return await docClient.put(params).promise();
//   })
// );

//   console.log(`Lookup table ${lookupTables[2]} saved`);

//   console.log("End saving lookups lookups");
// }

// return {
//   body: `saved the countries`,
// }
//
