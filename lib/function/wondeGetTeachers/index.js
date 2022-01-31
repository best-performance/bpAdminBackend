const axios = require("axios");

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

// gets the teachers from one school, with their contact details
async function getTeachers(wondeSchoolID) {
  let teacherClassrooms = []; // only classrooms from teh core 4 learning areas
  let teachers = []; // only teachers that teach at least one of the 4 core learning areas
  try {
    let URL = `${getURL()}/${wondeSchoolID}/employees/?has_class=true&include=contact_details,classes&per_page=200`;
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
      response.data.data.forEach((employee) => {
        let core4Teacher = false; // must teache at least one of the 4 learning areas
        employee.classes.data.forEach((classroom) => {
          let learningArea = getLearningArea(classroom.name); // returns either false or the learning Area
          if (learningArea) {
            core4Teacher = true;
            teacherClassrooms.push({
              wondeTeacherId: employee.id,
              wondeClassroomId: classroom.id,
              classroomName: classroom.name,
              classroomLearningArea: learningArea,
            });
          }
        });
        if (core4Teacher) {
          teachers.push({
            wondeTeacherId: employee.id,
            mis_id: employee.mis_id,
            title: employee.title,
            firstName: employee.forename,
            lastName: employee.surname,
            email: employee.contact_details.data.emails.email,
          });
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
    console.log("error reading Wonde teachers", error.message);
    return { result: false, msg: error.message };
  }
  return { result: true, teachers: teachers, classrooms: teacherClassrooms };
}

exports.handler = async function (event) {
  const wondeSchoolID = event.queryStringParameters.wondeID; // WondeID is the Wonde school id
  console.log(wondeSchoolID);
  // response should be an array of 2 arrays - teachers and teacherClassrooms
  let response = await getTeachers(wondeSchoolID);

  if (response.result)
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(response),
    };
  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(response),
  };
};
