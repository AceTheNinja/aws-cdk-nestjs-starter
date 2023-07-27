import {
  CfnOutput,
  SecretValue,
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_ecr as ecr,
  aws_ecs as ecs,
} from 'aws-cdk-lib';

import { WebApp } from './server';
import { Construct } from 'constructs';
import env from '../env';

interface PipelineProps {
  readonly webapp: WebApp;
}

class Pipeline extends Construct {
  private readonly webapp: WebApp;

  readonly service: ecs.IBaseService;
  readonly containerName: string;
  readonly ecrRepo: ecr.Repository;

  public readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id);
    this.webapp = props.webapp;
    this.service = this.webapp.service;
    this.ecrRepo = this.webapp.ecrRepo;
    this.containerName = this.webapp.containerName;

    this.pipeline = this.createPipeline();
    this.output();
  }

  // Creates the pipeline structure
  private createPipeline(): codepipeline.Pipeline {
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();
    return new codepipeline.Pipeline(this, env.pipeline.id, {
      stages: [
        this.createSourceStage('Source', sourceOutput),
        this.createImageBuildStage('Build', sourceOutput, buildOutput),
        this.createDeployStage('Deploy', buildOutput),
      ],
    });
  }

  // Create a stage that retrieves source code from GitHub
  private createSourceStage(
    stageName: string,
    output: codepipeline.Artifact,
  ): codepipeline.StageProps {
    const githubAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'Github_Source',
      owner: env.pipeline.source.github.owner,
      repo: env.pipeline.source.github.repo,
      oauthToken: SecretValue.secretsManager(env.pipeline.source.github.tokenSecretName),
      branch: env.pipeline.source.github.branch,
      output: output,
    });
    return {
      stageName: stageName,
      actions: [githubAction],
    };
  }

  // Create the pipeline build stage
  private createImageBuildStage(
    stageName: string,
    input: codepipeline.Artifact,
    output: codepipeline.Artifact,
  ): codepipeline.StageProps {
    const project = new codebuild.PipelineProject(this, env.pipeline.build.id, {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true,
      },
      environmentVariables: {
        REPOSITORY_URI: { value: this.ecrRepo.repositoryUri },
        CONTAINER_NAME: { value: this.containerName },
      },
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
    });

    this.ecrRepo.grantPullPush(project.grantPrincipal);

    const codebuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild_Action',
      input: input,
      outputs: [output],
      project: project,
    });

    return {
      stageName: stageName,
      actions: [codebuildAction],
    };
  }

  // Create the pipeline deploy stage
  createDeployStage(
    stageName: string,
    input: codepipeline.Artifact,
  ): codepipeline.StageProps {
    const ecsDeployAction = new codepipeline_actions.EcsDeployAction({
      actionName: 'ECSDeploy_Action',
      input: input,
      service: this.service,
    });
    return {
      stageName: stageName,
      actions: [ecsDeployAction],
    };
  }

  output() {
    // create a cloudformation output for the ARN of the pipeline
    new CfnOutput(this, 'Pipeline ARN', {
      value: this.pipeline.pipelineArn,
    });
  }
}

export { Pipeline, PipelineProps };
