#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CdkBackendStack } from "../lib/cdk_backend-stack";

const app = new cdk.App();
new CdkBackendStack(app, "CdkBackendStack", {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the required line if you know exactly what Account and Region you */
  env: { account: "915169774712", region: "ap-southeast-2" }, //sandbox, Sydney
  //env: { account: "915169774712", region: "eu-west-2" }, //sandbox, London
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
