import * as amplify from "@aws-cdk/aws-amplify-alpha"; // not in V2 aws-cdk-lib yet
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as path from "path"; // see here https://www.w3schools.com/nodejs/ref_path.asp
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { UserPoolClient } from "aws-cdk-lib/aws-cognito";

export class CdkBackendStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create a Cognnito User Pool
    const userPool = new cognito.UserPool(this, "WondeUserPool", {
      selfSignUpEnabled: false, // dont allow users to sign up
      autoVerify: { email: true },
      signInAliases: { email: true }, // set email as an alias
    });

    const userPoolClient = new UserPoolClient(this, "WondeUserPoolClient", {
      userPool,
      generateSecret: false, // not needed for web apps
    });

    // create a test lambda and ApiGateway (TODO :remove this)
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
    // TODO: Remove above

    // add lambda to get the Wonde schools
    const wondeallschools = new lambda.Function(this, "WondeGetAllSchools", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "function", "wondeGetAllSchools")),
    });
    apiGateway.root // add route to API Gateway
      .resourceForPath("wondeallschools")
      .addMethod("GET", new apigw.LambdaIntegration(wondeallschools));

    // add lambda to save the selected Wonde SChool data in the Schools table
    const saveWondeSchool = new lambda.Function(this, "SaveWondeSchool", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "function", "saveWondeSchool")),
    });
    apiGateway.root
      .resourceForPath("saveWondeSchool")
      .addMethod("PUT", new apigw.LambdaIntegration(saveWondeSchool));

    // add lambda to download the Wonde students and classes for a school
    const wondeStudents = new lambda.Function(this, "WondeGetStudents", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(30), // default timeout is 3 secs - too short
      code: lambda.Code.fromAsset(path.join(__dirname, "function", "wondeGetStudents")),
    });
    apiGateway.root
      .resourceForPath("wondestudents")
      .addMethod("GET", new apigw.LambdaIntegration(wondeStudents));

    // add lambda to download the Wonde students and classes for a school
    const wondeTeachers = new lambda.Function(this, "WondeGetTeachers", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(30), // default timeout is 3 secs - too short
      code: lambda.Code.fromAsset(path.join(__dirname, "function", "wondeGetTeachers")),
    });
    apiGateway.root
      .resourceForPath("wondeteachers")
      .addMethod("GET", new apigw.LambdaIntegration(wondeTeachers));

    // make the Schools table, grant lambda permissions and add a GSI
    //TODO: This table should be School NOT Schools
    const schoolTable = new dynamodb.Table(this, "Schools", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "Schools",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    schoolTable.grantFullAccess(saveWondeSchool); // grant permissions to lambda
    schoolTable.addGlobalSecondaryIndex({
      // add GSI on WondeID
      indexName: "wondeIDIndex",
      partitionKey: { name: "wondeID", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // make Student table
    const studentTable = new dynamodb.Table(this, "student", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "Student",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    studentTable.grantFullAccess(saveWondeSchool); // grant permissions to lambda

    // Make User table (verify partitionKey)
    const userTable = new dynamodb.Table(this, "user", {
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "User",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    userTable.grantFullAccess(saveWondeSchool); // grant permissions to lambda

    // Make Classroom table
    const classroomTable = new dynamodb.Table(this, "classroom", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "Classroom",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    classroomTable.grantFullAccess(saveWondeSchool); // grant permissions to lambda

    // Make ClassroomStudent table
    const classroomStudentTable = new dynamodb.Table(this, "classroomStudent", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "ClassroomStudent",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    classroomStudentTable.grantFullAccess(saveWondeSchool); // grant permissions to lambda

    // Make ClassroomTeacher table
    const classroomTeacherTable = new dynamodb.Table(this, "classroomTeacher", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "ClassroomTeacher",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    classroomTeacherTable.grantFullAccess(saveWondeSchool); // grant permissions to lambda

    // Make ClassroomYearLevel table
    const classroomYearLevelTable = new dynamodb.Table(this, "classroomYearLevel", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "ClassroomYearLevel",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    classroomYearLevelTable.grantFullAccess(saveWondeSchool); // grant permissions to lambda

    // Make ClassroomLearningArea table
    const classroomLearningAreaTable = new dynamodb.Table(this, "classroomLearningArea", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "ClassroomLearningArea",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    classroomLearningAreaTable.grantFullAccess(saveWondeSchool); // grant permissions to lambda

    // Make SchoolStudent table
    const schoolStudentTable = new dynamodb.Table(this, "SchoolStudent", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "SchoolStudent",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    schoolStudentTable.grantFullAccess(saveWondeSchool); // grant permissions to lambda

    // make lookup tables needed for school imports(populate manually)
    // make Country table
    const countryTable = new dynamodb.Table(this, "country", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "Country",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    countryTable.grantFullAccess(saveWondeSchool);
    // make a State table
    const stateTable = new dynamodb.Table(this, "state", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "State",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    stateTable.grantFullAccess(saveWondeSchool);
    // make a YearLevel table
    const yearLevelTable = new dynamodb.Table(this, "yearLevel", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "YearLevel",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    yearLevelTable.grantFullAccess(saveWondeSchool);
    // make a LearningArea table
    const learningAreaTable = new dynamodb.Table(this, "learningAaea", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "LearningArea",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    learningAreaTable.grantFullAccess(saveWondeSchool);

    // Create an amplify app and link it to the frontEnd repo
    // the gitHub access token is "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"
    const amplifyApp = new amplify.App(this, "amplify-cdk", {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: "bcperth01",
        repository: "bpAdminAmplify",
        //oauthToken: cdk.SecretValue.secretsManager('github-token')
        oauthToken: cdk.SecretValue.plainText("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"),
      }),

      // These appear in the Amplify Console for this application
      // The React frontend can get these using process.env() - via the amplify.yml
      environmentVariables: {
        ENDPOINT: apiGateway.url,
        REGION: this.region,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    // use the "main" branch of the repo
    amplifyApp.addBranch("main");
  }
}
