import * as amplify from "@aws-cdk/aws-amplify-alpha"; // not in V2 aws-cdk-lib yet
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as path from "path"; // see here https://www.w3schools.com/nodejs/ref_path.asp
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export class CdkBackendStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
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
      .addMethod("PUT", new apigw.LambdaIntegration(saveWondeSchool));

    // add lambda and ApiGateway route to get the Wonde students and classes for a school
    const wondeStudents = new lambda.Function(this, "WondeGetStudents", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(30), // default timeout is 3 secs - too short
      code: lambda.Code.fromAsset(path.join(__dirname, "function", "wondeGetStudents")),
    });

    apiGateway.root
      .resourceForPath("wondestudents")
      .addMethod("GET", new apigw.LambdaIntegration(wondeStudents));

    // add lambda and ApiGateway route to get the Wonde students and classes for a school
    const wondeTeachers = new lambda.Function(this, "WondeGetTeachers", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(30), // default timeout is 3 secs - too short
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

    //allow the lambda full access to the school table
    // This add an online permission to teh lambda
    // There is probably a way to give general access to all tables??
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
