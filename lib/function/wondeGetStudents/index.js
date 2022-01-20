const axios = require("axios");
const _ = require("lodash");
var dayjs = require("dayjs");

const AUSURL = "https://api-ap-southeast-2.wonde.com/v1.0/schools";
const AUSTOKEN = "Bearer 66018aef288a2a7dadcc53e26e4daf383dbb5e8e";

// gets the students list from one school - with classrooms and teachers
async function getStudents(wondeSchoolID) {
  let students = [];
  let classrooms = [];
  let uniqueClassrooms = [];
  try {
    let URL = `${AUSURL}/${wondeSchoolID}/students?include=classes.employees,year&per_page=200`;
    let morePages = true;
    while (morePages) {
      console.log(URL);
      let response = await axios({
        method: "get",
        url: URL,
        headers: {
          Authorization: AUSTOKEN,
        },
      });
      // eslint-disable-next-line no-loop-func
      response.data.data.forEach((student) => {
        //if (student.id === 'B1345707233') console.log(student)
        if (student.classes.data.length > 0 && student.year.data.code !== "40") {
          let dob = dayjs(student.date_of_birth.date).format("DD MMM YYYY");
          students.push({
            id: student.id,
            mis_id: student.mis_id,
            firstName: student.forename,
            lastName: student.surname,
            gender: student.gender,
            dob: dob,
            year: student.year.data.code,
          });
          student.classes.data.forEach((classroom) => {
            classrooms.push({
              studentID: student.id,
              mis_id: classroom.mis_id,
              classId: classroom.id,
              className: classroom.name,
              teacherId:
                classroom.employees.data.length > 0 ? classroom.employees.data[0].id : "no teacher",
              teacherFirstName:
                classroom.employees.data.length > 0
                  ? classroom.employees.data[0].forename
                  : "no teacher",
              teacherLastName:
                classroom.employees.data.length > 0
                  ? classroom.employees.data[0].surname
                  : "no teacher",
            });
            if (!uniqueClassrooms.find((uniqueClassroom) => uniqueClassroom.id === classroom.id)) {
              uniqueClassrooms.push({
                id: classroom.id,
                mis_id: classroom.mis_id,
                className: classroom.name,
                schoolYear: student.year.data.code,
              });
            }
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
    console.log(error);
  }
  students = _.sortBy(students, (y) => parseInt(y.year));
  return { students: students, classrooms: classrooms, uniqueClassrooms: uniqueClassrooms };
}

exports.handler = async function (event) {
  const wondeSchoolID = event.queryStringParameters.wondeID; // WondeID is the Wonde school id
  console.log(wondeSchoolID);

  // response should be an array of 2 arrays - students and classrooms
  let response = await getStudents(wondeSchoolID);
  console.log(event);
  //console.log(response.classrooms)

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(response),
  };
};
