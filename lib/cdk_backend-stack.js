"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdkBackendStack = void 0;
const amplify = require("@aws-cdk/aws-amplify-alpha"); // not in V2 aws-cdk-lib yet
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigw = require("aws-cdk-lib/aws-apigateway");
const path = require("path"); // see here https://www.w3schools.com/nodejs/ref_path.asp
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
class CdkBackendStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // create a lambda and ApiGatewa
        const testLambda = new lambda.Function(this, "TestLambda", {
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "function", "test")),
        });
        const apiGateway = new apigw.RestApi(this, "TestApiGateway", {
            defaultCorsPreflightOptions: {
                allowOrigins: apigw.Cors.ALL_ORIGINS,
                allowMethods: apigw.Cors.ALL_METHODS,
                allowHeaders: ["*"],
            },
        });
        // add ApiGateway test route
        apiGateway.root
            .resourceForPath("test")
            .addMethod("GET", new apigw.LambdaIntegration(testLambda));
        // add lambda and ApiGateway route to get the Wonde schools
        const wondeallschools = new lambda.Function(this, "WondeGetAllSchools", {
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "function", "wondeGetAllSchools")),
        });
        apiGateway.root
            .resourceForPath("wondeallschools")
            .addMethod("GET", new apigw.LambdaIntegration(wondeallschools));
        // add lambda and ApiGateway route to save the selected Wonde in the Schools table
        const saveWondeSchool = new lambda.Function(this, "SaveWondeSchool", {
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "function", "saveWondeSchool")),
        });
        apiGateway.root
            .resourceForPath("saveWondeSchool")
            .addMethod("GET", new apigw.LambdaIntegration(saveWondeSchool));
        // add lambda and ApiGateway route to get the Wonde students and classes for a school
        const wondeStudents = new lambda.Function(this, "WondeGetStudents", {
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "index.handler",
            timeout: cdk.Duration.seconds(30),
            code: lambda.Code.fromAsset(path.join(__dirname, "function", "wondeGetStudents")),
        });
        apiGateway.root
            .resourceForPath("wondestudents")
            .addMethod("GET", new apigw.LambdaIntegration(wondeStudents));
        // add lambda and ApiGateway route to get the Wonde students and classes for a school
        const wondeTeachers = new lambda.Function(this, "WondeGetTeachers", {
            runtime: lambda.Runtime.NODEJS_14_X,
            handler: "index.handler",
            timeout: cdk.Duration.seconds(30),
            code: lambda.Code.fromAsset(path.join(__dirname, "function", "wondeGetTeachers")),
        });
        apiGateway.root
            .resourceForPath("wondeteachers")
            .addMethod("GET", new apigw.LambdaIntegration(wondeTeachers));
        // make a Schools table
        const schooldTable = new dynamodb.Table(this, "Schools", {
            partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            tableName: "Schools",
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        //allow the lambda full access to the table
        schooldTable.grantFullAccess(saveWondeSchool);
        // add global secondary index on the wondeID
        schooldTable.addGlobalSecondaryIndex({
            indexName: "wondeIDIndex",
            partitionKey: { name: "wondeID", type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // Create an amplify app and link it to the frontEnd repo
        // the git hib access token is "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"
        const amplifyApp = new amplify.App(this, "amplify-cdk", {
            sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
                owner: "bcperth01",
                repository: "bpAdminAmplify",
                //oauthToken: cdk.SecretValue.secretsManager('github-token')
                oauthToken: cdk.SecretValue.plainText("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"),
            }),
            //the React frontend can get these using process.env()
            environmentVariables: {
                ENDPOINT: apiGateway.url,
                REGION: this.region,
            },
        });
        // use the "main" branch of the repo
        amplifyApp.addBranch("main");
        // example resource
        // const queue = new sqs.Queue(this, 'CdkBackendQueue', {
        //   visibilityTimeout: cdk.Duration.seconds(300)
        // });
    }
}
exports.CdkBackendStack = CdkBackendStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrX2JhY2tlbmQtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjZGtfYmFja2VuZC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxzREFBc0QsQ0FBQyw0QkFBNEI7QUFDbkYsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCxvREFBb0Q7QUFDcEQsNkJBQTZCLENBQUMseURBQXlEO0FBQ3ZGLHFEQUFxRDtBQUVyRCxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDNUMsWUFBWSxLQUFjLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzVELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGdDQUFnQztRQUNoQyxNQUFNLFVBQVUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN6RCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDdEUsQ0FBQyxDQUFDO1FBRUgsTUFBTSxVQUFVLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUMzRCwyQkFBMkIsRUFBRTtnQkFDM0IsWUFBWSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDcEMsWUFBWSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDcEMsWUFBWSxFQUFFLENBQUMsR0FBRyxDQUFDO2FBQ3BCO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsNEJBQTRCO1FBQzVCLFVBQVUsQ0FBQyxJQUFJO2FBQ1osZUFBZSxDQUFDLE1BQU0sQ0FBQzthQUN2QixTQUFTLENBQUMs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Q2pELE1BQU07SUFDUixDQUFDO0NBQ0Y7QUE5R0QsMENBOEdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYW1wbGlmeSBmcm9tIFwiQGF3cy1jZGsvYXdzLWFtcGxpZnktYWxwaGFcIjsgLy8gbm90IGluIFYyIGF3cy1jZGstbGliIHlldFxuaW1wb3J0ICogYXMgY2RrIGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtbGFtYmRhXCI7XG5pbXBvcnQgKiBhcyBhcGlndyBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXlcIjtcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjsgLy8gc2VlIGhlcmUgaHR0cHM6Ly93d3cudzNzY2hvb2xzLmNvbS9ub2RlanMvcmVmX3BhdGguYXNwXG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiXCI7XG5cbmV4cG9ydCBjbGFzcyBDZGtCYWNrZW5kU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkFwcCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gY3JlYXRlIGEgbGFtYmRhIGFuZCBBcGlHYXRld2FcbiAgICBjb25zdCB0ZXN0TGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIlRlc3RMYW1iZGFcIiwge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE0X1gsXG4gICAgICBoYW5kbGVyOiBcImluZGV4LmhhbmRsZXJcIixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCBcImZ1bmN0aW9uXCIsIFwidGVzdFwiKSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlHYXRld2F5ID0gbmV3IGFwaWd3LlJlc3RBcGkodGhpcywgXCJUZXN0QXBpR2F0ZXdheVwiLCB7XG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlndy5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWd3LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogW1wiKlwiXSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgLy8gYWRkIEFwaUdhdGV3YXkgdGVzdCByb3V0ZVxuICAgIGFwaUdhdGV3YXkucm9vdFxuICAgICAgLnJlc291cmNlRm9yUGF0aChcInRlc3RcIilcbiAgICAgIC5hZGRNZXRob2QoXCJHRVRcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHRlc3RMYW1iZGEpKTtcblxuICAgIC8vIGFkZCBsYW1iZGEgYW5kIEFwaUdhdGV3YXkgcm91dGUgdG8gZ2V0IHRoZSBXb25kZSBzY2hvb2xzXG4gICAgY29uc3Qgd29uZGVhbGxzY2hvb2xzID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcIldvbmRlR2V0QWxsU2Nob29sc1wiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMTRfWCxcbiAgICAgIGhhbmRsZXI6IFwiaW5kZXguaGFuZGxlclwiLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsIFwiZnVuY3Rpb25cIiwgXCJ3b25kZUdldEFsbFNjaG9vbHNcIikpLFxuICAgIH0pO1xuXG4gICAgYXBpR2F0ZXdheS5yb290XG4gICAgICAucmVzb3VyY2VGb3JQYXRoKFwid29uZGVhbGxzY2hvb2xzXCIpXG4gICAgICAuYWRkTWV0aG9kKFwiR0VUXCIsIG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih3b25kZWFsbHNjaG9vbHMpKTtcblxuICAgIC8vIGFkZCBsYW1iZGEgYW5kIEFwaUdhdGV3YXkgcm91dGUgdG8gc2F2ZSB0aGUgc2VsZWN0ZWQgV29uZGUgaW4gdGhlIFNjaG9vbHMgdGFibGVcbiAgICBjb25zdCBzYXZlV29uZGVTY2hvb2wgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiU2F2ZVdvbmRlU2Nob29sXCIsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xNF9YLFxuICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgXCJmdW5jdGlvblwiLCBcInNhdmVXb25kZVNjaG9vbFwiKSksXG4gICAgfSk7XG5cbiAgICBhcGlHYXRld2F5LnJvb3RcbiAgICAgIC5yZXNvdXJjZUZvclBhdGgoXCJzYXZlV29uZGVTY2hvb2xcIilcbiAgICAgIC5hZGRNZXRob2QoXCJHRVRcIiwgbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKHNhdmVXb25kZVNjaG9vbCkpO1xuXG4gICAgLy8gYWRkIGxhbWJkYSBhbmQgQXBpR2F0ZXdheSByb3V0ZSB0byBnZXQgdGhlIFdvbmRlIHN0dWRlbnRzIGFuZCBjbGFzc2VzIGZvciBhIHNjaG9vbFxuICAgIGNvbnN0IHdvbmRlU3R1ZGVudHMgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiV29uZGVHZXRTdHVkZW50c1wiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMTRfWCxcbiAgICAgIGhhbmRsZXI6IFwiaW5kZXguaGFuZGxlclwiLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLCAvLyBkZWZhdWx0IHRpbWVvdXQgaXMgMyBzZWNzIC0gdG9vIHNob3J0XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgXCJmdW5jdGlvblwiLCBcIndvbmRlR2V0U3R1ZGVudHNcIikpLFxuICAgIH0pO1xuXG4gICAgYXBpR2F0ZXdheS5yb290XG4gICAgICAucmVzb3VyY2VGb3JQYXRoKFwid29uZGVzdHVkZW50c1wiKVxuICAgICAgLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24od29uZGVTdHVkZW50cykpO1xuXG4gICAgLy8gYWRkIGxhbWJkYSBhbmQgQXBpR2F0ZXdheSByb3V0ZSB0byBnZXQgdGhlIFdvbmRlIHN0dWRlbnRzIGFuZCBjbGFzc2VzIGZvciBhIHNjaG9vbFxuICAgIGNvbnN0IHdvbmRlVGVhY2hlcnMgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsIFwiV29uZGVHZXRUZWFjaGVyc1wiLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMTRfWCxcbiAgICAgIGhhbmRsZXI6IFwiaW5kZXguaGFuZGxlclwiLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLCAvLyBkZWZhdWx0IHRpbWVvdXQgaXMgMyBzZWNzIC0gdG9vIHNob3J0XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgXCJmdW5jdGlvblwiLCBcIndvbmRlR2V0VGVhY2hlcnNcIikpLFxuICAgIH0pO1xuXG4gICAgYXBpR2F0ZXdheS5yb290XG4gICAgICAucmVzb3VyY2VGb3JQYXRoKFwid29uZGV0ZWFjaGVyc1wiKVxuICAgICAgLmFkZE1ldGhvZChcIkdFVFwiLCBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24od29uZGVUZWFjaGVycykpO1xuXG4gICAgLy8gbWFrZSBhIFNjaG9vbHMgdGFibGVcbiAgICBjb25zdCBzY2hvb2xkVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJTY2hvb2xzXCIsIHtcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiBcImlkXCIsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgdGFibGVOYW1lOiBcIlNjaG9vbHNcIixcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvL2FsbG93IHRoZSBsYW1iZGEgZnVsbCBhY2Nlc3MgdG8gdGhlIHRhYmxlXG4gICAgc2Nob29sZFRhYmxlLmdyYW50RnVsbEFjY2VzcyhzYXZlV29uZGVTY2hvb2wpO1xuXG4gICAgLy8gYWRkIGdsb2JhbCBzZWNvbmRhcnkgaW5kZXggb24gdGhlIHdvbmRlSURcbiAgICBzY2hvb2xkVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiBcIndvbmRlSURJbmRleFwiLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6IFwid29uZGVJRFwiLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTCxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBhbiBhbXBsaWZ5IGFwcCBhbmQgbGluayBpdCB0byB0aGUgZnJvbnRFbmQgcmVwb1xuICAgIC8vIHRoZSBnaXQgaGliIGFjY2VzcyB0b2tlbiBpcyBcImdocF9BNEtidmhiQ05lQnJHVEtIVGVvOWE1MFZ3bEJCNEUwOVJMS0xcIlxuICAgIGNvbnN0IGFtcGxpZnlBcHAgPSBuZXcgYW1wbGlmeS5BcHAodGhpcywgXCJhbXBsaWZ5LWNka1wiLCB7XG4gICAgICBzb3VyY2VDb2RlUHJvdmlkZXI6IG5ldyBhbXBsaWZ5LkdpdEh1YlNvdXJjZUNvZGVQcm92aWRlcih7XG4gICAgICAgIG93bmVyOiBcImJjcGVydGgwMVwiLFxuICAgICAgICByZXBvc2l0b3J5OiBcImJwQWRtaW5BbXBsaWZ5XCIsXG4gICAgICAgIC8vb2F1dGhUb2tlbjogY2RrLlNlY3JldFZhbHVlLnNlY3JldHNNYW5hZ2VyKCdnaXRodWItdG9rZW4nKVxuICAgICAgICBvYXV0aFRva2VuOiBjZGsuU2VjcmV0VmFsdWUucGxhaW5UZXh0KFwiZ2hwX0E0S2J2aGJDTmVCckdUS0hUZW85YTUwVndsQkI0RTA5UkxLTFwiKSxcbiAgICAgIH0pLFxuICAgICAgLy90aGUgUmVhY3QgZnJvbnRlbmQgY2FuIGdldCB0aGVzZSB1c2luZyBwcm9jZXNzLmVudigpXG4gICAgICBlbnZpcm9ubWVudFZhcmlhYmxlczoge1xuICAgICAgICBFTkRQT0lOVDogYXBpR2F0ZXdheS51cmwsXG4gICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICB9LFxuICAgIH0pO1xuICAgIC8vIHVzZSB0aGUgXCJtYWluXCIgYnJhbmNoIG9mIHRoZSByZXBvXG4gICAgYW1wbGlmeUFwcC5hZGRCcmFuY2goXCJtYWluXCIpO1xuXG4gICAgLy8gZXhhbXBsZSByZXNvdXJjZVxuICAgIC8vIGNvbnN0IHF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnQ2RrQmFja2VuZFF1ZXVlJywge1xuICAgIC8vICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMClcbiAgICAvLyB9KTtcbiAgfVxufVxuIl19