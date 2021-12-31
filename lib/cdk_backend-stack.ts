import { Stack, StackProps } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as amplify from "@aws-cdk/aws-amplify-alpha"; // not in V2 aws-cdk-lib yet

export class CdkBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create an amplify app and link it to the frontEnd repo
    // the git hib access token is "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"
    const amplifyApp = new amplify.App(this, "amplify-cdk", {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: "bcperth01",
        repository: "bpAdminAmplify",
        //oauthToken: cdk.SecretValue.secretsManager('github-token')
        oauthToken: cdk.SecretValue.plainText("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"),
      }),
    });
    // use the "main" branch of the repo
    amplifyApp.addBranch("main");

    // example resource
    // const queue = new sqs.Queue(this, 'CdkBackendQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
