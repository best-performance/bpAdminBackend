const axios = require("axios");

const AUSURL = "https://api-ap-southeast-2.wonde.com/v1.0/schools";
const AUSTOKEN = "Bearer 66018aef288a2a7dadcc53e26e4daf383dbb5e8e";

// gets the teachers from one school, with their contact details
async function getTeachers(wondeSchoolID) {
  let teacherClassrooms = [];
  let teachers = [];
  try {
    let URL = `${AUSURL}/${wondeSchoolID}/employees/?has_class=true&include=contact_details,classes&per_page=200`;
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
      response.data.data.forEach((employee) => {
        if (employee.classes.data.length > 0) {
          teachers.push({
            id: employee.id,
            title: employee.title,
            firstName: employee.forename,
            lastName: employee.surname,
            email: employee.contact_details.data.emails.email,
          });
          employee.classes.data.forEach((classroom) => {
            teacherClassrooms.push({
              teacherId: employee.id,
              classId: classroom.id,
              classDescription: classroom.description,
            });
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
  return { teachers: teachers, classrooms: teacherClassrooms };
}

exports.handler = async function (event) {
  const wondeSchoolID = event.queryStringParameters.wondeID; // WondeID is the Wonde school id
  console.log(wondeSchoolID);
  // response should be an array of 2 arrays - teachers and teacherClassrooms
  let response = await getTeachers(wondeSchoolID);

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(response),
  };
};
