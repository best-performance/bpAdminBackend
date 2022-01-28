exports.handler = async function (event) {
  // console.log(event); too long...
  console.log("request parameters:", event.queryStringParameters); // to test param passing

  return {
    statusCode: 200,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(`Region: ${process.env.AWS_REGION}`),
  };
};
