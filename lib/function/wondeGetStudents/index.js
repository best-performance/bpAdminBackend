const axios = require("axios");
const _ = require("lodash");
var dayjs = require("dayjs");

// These are hard-coded for convenience ToDo: Save elsewhere
const UKURL = "https://api.wonde.com/v1.0/schools";
const UKTOKEN = "Bearer 6c69f7050215eff18895eeb63d6bd0df0545f0da";
const AUSURL = "https://api-ap-southeast-2.wonde.com/v1.0/schools";
const AUSTOKEN = "Bearer 66018aef288a2a7dadcc53e26e4daf383dbb5e8e";

// FEATURE-TOGGLE
function getURL() {
  switch (process.env.AWS_REGION) {
    case "ap-southeast-2":
      return AUSURL;
    case "eu-west-2":
      return UKURL;
    default:
      return AUSURL;
  }
}
// FEATURE-TOGGLE
function getToken() {
  switch (process.env.AWS_REGION) {
    case "ap-southeast-2":
      return AUSTOKEN;
    case "eu-west-2":
      return UKTOKEN;
    default:
      return AUSTOKEN;
  }
}

// find a class's learning Area
function getLearningArea(className) {
  // must be one of Mathematics, English, Technology, Science
  let classNameUpper = className.toUpperCase();
  if (classNameUpper.includes("MATH")) {
    return "Mathematics";
  }
  if (classNameUpper.includes("ENGL")) {
    return "English";
  }
  if (classNameUpper.includes("SCI")) {
    return "Science";
  }
  if (classNameUpper.includes("TECHN") || classNameUpper.includes("IT APP")) {
    return "Technology";
  }
  return false;
}

// gets the students list from one school - with classrooms and teachers
async function getStudents(wondeSchoolID) {
  let students = []; // only studenst taht take at least one core 4 learning areas
  let studentClassrooms = []; // only core 4 classrooms
  try {
    let URL = `${getURL()}/${wondeSchoolID}/students?include=classes.employees,year&per_page=200`;
    let morePages = true;
    while (morePages) {
      console.log(URL);
      let response = await axios({
        method: "get",
        url: URL,
        headers: {
          Authorization: getToken(),
        },
      });
      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((student) => {
        let core4Student = false; // must attend at least one core learningArea
        if (
          student.classes.data.length > 0 &&
          student.year.data.code !== "40"
        ) {
          student.classes.data.forEach((classroom) => {
            let learningArea = getLearningArea(classroom.name); // returns either false or the learning Area
            if (learningArea) {
              // false if not a core 4 learning area
              core4Student = true;
              studentClassrooms.push({
                wondeStudentId: student.id,
                mis_id: classroom.mis_id,
                wondeClassroomId: classroom.id,
                classroomName: classroom.name,
                yearLevel: student.year.data.code, // we will need to know class year levels later
                classroomLearningArea: learningArea,
                teacherId:
                  classroom.employees.data.length > 0
                    ? classroom.employees.data[0].id
                    : "no teacher",
              });
            }
          });
          if (core4Student) {
            let dob = dayjs(student.date_of_birth.date).format("DD MMM YYYY");
            students.push({
              wondeStudentId: student.id,
              mis_id: student.mis_id,
              firstName: student.forename,
              lastName: student.surname,
              gender: student.gender,
              dob: dob,
              year: student.year.data.code,
            });
          }
        }
      });
      // check if all pages are read
      if (response.data.meta.pagination.next != null) {
        URL = response.data.meta.pagination.next;
      } else {
        morePages = false;
      }
    }
  } catch (error) {
    console.log(error);
  }
  students = _.sortBy(students, (y) => parseInt(y.year));
  return {
    students: students,
    classrooms: studentClassrooms,
  };
}

exports.handler = async function (event) {
  const wondeSchoolID = event.queryStringParameters.wondeID; // WondeID is the Wonde school id
  console.log(wondeSchoolID);

  // response should be an array of 2 arrays - students and classrooms
  let response = await getStudents(wondeSchoolID);
  console.log(event);

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(response),
  };
};
