const AWS = require("aws-sdk");
const { parse } = require("csv-parse/sync"); // to parse csv files
const fsp = require("fs").promises; // basic file reading - no install needed

// These tables were creaetd by the CDK
// Not needed for the prod uploader - only while in sandbox
const COUNTRY_TABLE_NAME = "Country";
const STATE_TABLE_NAME = "State";
const LEARNINGAREA_TABLE_NAME = "LearningArea";
const YEARLEVEL_TABLE_NAME = "YearLevel";

const lookupTables = [
  "./lookupData/Country.csv",
  "./lookupData/State.csv",
  "./lookupData/LearningArea.csv",
  "./lookupData/YearLevel.csv",
];

exports.populateLookups = async () => {
  // read in an populate the lookup tables ( data in csv files is from edCompanion prod)
  console.log("starting saving lookups");

  const docClient = new AWS.DynamoDB.DocumentClient(); // used by all functions

  // We define the sub functions as async in order to push them to a stack to be executed
  // sequentially. Refer to this link:
  //https://www.coreycleary.me/executing-arrays-of-async-await-javascript-functions-in-series-vs-concurrently/

  async function runAll() {
    let fnArray = [];
    let responseArray = [];
    //fnArray.push(populateCountry);
    //fnArray.push(populateState);
    //fnArray.push(populateLearningArea);
    //fnArray.push(populateYearLevel); // 14 records 1.8 secs without docClient.put() x 14
    //fnArray.push(populateYearLevelBatch); // 14 recods in 700mS with docClient.batchWrite()

    for (const fn of fnArray) {
      let response = await fn(); // call function to get returned Promise
      responseArray.push(response);
    }

    console.log(responseArray);
    return "populateLookups done....";
  }

  await runAll();
  return "populateLookups done";
  /** ---------------------------------------------------------------------- */
  async function populateCountry() {
    // only one record!
    try {
      let csvData = await fsp.readFile(lookupTables[0]); // read the Country csv
      let parsedData = parse(csvData, { columns: true }); // parse to array of objects
      console.log(`${lookupTables[0]}`, parsedData);

      console.time("Country saved in");
      const params = {
        TableName: COUNTRY_TABLE_NAME,
        Item: {
          id: parsedData[0].id,
          __typename: parsedData[0].__typename,
          createdAt: parsedData[0].createdAt,
          updateAt: parsedData[0].updatedAt,
          countryCode: parsedData[0].countryCode,
          name: parsedData[0].name,
        },
      };
      await docClient.put(params).promise();
      console.timeEnd("Country saved in");

      console.log(`Lookup table ${lookupTables[0]} saved`);
      return true; // all good
    } catch (error) {
      console.log(error);
      return { error };
    }
  }

  /** ---------------------------------------------------------------------- */
  async function populateState() {
    try {
      csvData = await fsp.readFile(lookupTables[1]); // read the State csv
      parsedData = parse(csvData, { columns: true }); // parse to array of objects
      console.log(`${lookupTables[1]}`, parsedData);

      console.time("States saved in");
      await Promise.all(
        parsedData.map((item) => {
          // save to table
          const params = {
            TableName: STATE_TABLE_NAME,
            Item: {
              id: item.id,
              __typename: item.__typename,
              createdAt: item.createdAt,
              updateAt: item.updatedAt,
              countryID: item.countryID,
              stateCode: item.stateCode,
              name: item.name,
            },
          };
          return docClient.put(params).promise();
        })
      );
      console.timeEnd("States saved in");
      return true; // all good
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  /** ---------------------------------------------------------------------- */
  async function populateLearningArea() {
    try {
      csvData = await fsp.readFile(lookupTables[2]); // read the LearningArea csv
      parsedData = parse(csvData, { columns: true }); // parse to array of objects
      console.log(`${lookupTables[2]}`, parsedData);

      console.time("LearningArea saved in");
      await Promise.all(
        parsedData.map((item) => {
          // save to table
          const params = {
            TableName: LEARNINGAREA_TABLE_NAME,
            Item: {
              id: item.id,
              __typeName: item.__typename,
              createdAt: item.createdAt,
              updateAt: item.updatedAt,
              areaName: item.areaName,
              colour: item.colour,
            },
          };
          return docClient.put(params).promise();
        })
      );
      console.timeEnd("LearningArea saved in");
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  /** ---------------------------------------------------------------------- */
  async function populateYearLevel() {
    // polulate the YearLevel lookup table
    try {
      csvData = await fsp.readFile(lookupTables[3]); // YearLevel.csv
      parsedData = parse(csvData, { columns: true }); // parse to array of objects

      console.log(`${lookupTables[3]}`, parsedData.length, parsedData[0]);

      console.time("YearLevels saved in");
      await Promise.all(
        parsedData.map((item, index) => {
          // save to table
          const params = {
            TableName: YEARLEVEL_TABLE_NAME,
            Item: {
              id: item.id,
              __typeName: item.__typename,
              createdAt: item.createdAt,
              updateAt: item.updatedAt,
              description: item.description,
              type: item.type,
              yearCode: item.yearCode,
            },
          };
          return docClient.put(params).promise();
        })
      );
      console.timeEnd("YearLevels saved in");
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  /** ---------------------------------------------------------------------- */
  async function populateYearLevelBatch() {
    // polulate the YearLevel lookup table, but using a batch upload
    try {
      csvData = await fsp.readFile(lookupTables[3]); // YearLevel.csv
      parsedData = parse(csvData, { columns: true }); // parse to array of objects

      console.log(`${lookupTables[3]}`, parsedData.length, parsedData[0]);

      let putRequestArray = parsedData.map((item, index) => {
        return {
          PutRequest: {
            Item: {
              id: item.id,
              __typeName: item.__typename,
              createdAt: item.createdAt,
              updateAt: item.updatedAt,
              description: item.description,
              type: item.type,
              yearCode: item.yearCode,
            },
          },
        };
      });

      const params = {
        RequestItems: {
          YearLevel: putRequestArray,
        },
      };
      //console.log(JSON.stringify(params));

      console.time("YearLevelsBatch saved in");
      let results = await docClient.batchWrite(params).promise();
      console.log(results);
      console.timeEnd("YearLevelsBatch saved in");

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
};
