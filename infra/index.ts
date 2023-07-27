import { WebApp } from './stacks/server';
import { Pipeline } from './stacks/pipeline';
import { Cluster } from './stacks/cluster';
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import env from './env';

class WebStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const cluster = new Cluster(this, 'Cluster');
    const webapp = new WebApp(this, 'WebApp', {
      cluster: cluster,
    });
    const pipeline = new Pipeline(this, 'Pipeline', {
      webapp: webapp,
    });
  }
}

const app = new App();
new WebStack(app, env.stack.id);
app.synth();
