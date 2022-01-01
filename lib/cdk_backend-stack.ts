import * as amplify from "@aws-cdk/aws-amplify-alpha"; // not in V2 aws-cdk-lib yet
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as path from "path"; // see here https://www.w3schools.com/nodejs/ref_path.asp

export class CdkBackendStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create a lambda and ApiGatewa
    const testLambda = new lambda.Function(this, "TestLambda", {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda")),
    });

    const apiGateway = new apigw.RestApi(this, "TestApiGateway", {
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ["*"],
      },
    });

    apiGateway.root
      .resourceForPath("hello")
      .addMethod("GET", new apigw.LambdaIntegration(testLambda));

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
