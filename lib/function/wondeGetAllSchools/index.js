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

// read all the schools from Wonde for region as above
async function getAllSchools() {
  let schools = [];
  try {
    let response = await axios({
      method: "get",
      url: getURL(),
      headers: {
        Authorization: getToken(),
      },
    });
    response.data.data.forEach((school) => {
      schools.push({
        wondeID: school.id,
        schoolName: school.name,
        urn: school.urn,
        address1: school.address.address_line_1,
        address2: school.address.address_line_2,
        town: school.address.address_town,
        country: school.address.address_country.name,
      });
    });
    return schools;
  } catch (err) {
    return [{ error: err.message }];
  }
}

exports.handler = async function (event) {
  // response should be an array of objects - one per school
  let response = await getAllSchools();

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(response),
  };
};
