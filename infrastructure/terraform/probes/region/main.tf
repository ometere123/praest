variable "region"{type=string} variable "artifact_bucket"{type=string} variable "artifact_key"{type=string} variable "praest_api_url"{type=string} variable "praest_internal_token"{type=string;sensitive=true}
provider "aws"{region=var.region}
data "aws_iam_policy_document" "assume"{statement{actions=["sts:AssumeRole"] principals{type="Service" identifiers=["lambda.amazonaws.com"]}}}
resource "aws_iam_role" "probe"{name="praest-probe-${var.region}" assume_role_policy=data.aws_iam_policy_document.assume.json}
resource "aws_iam_role_policy_attachment" "logs"{role=aws_iam_role.probe.name policy_arn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"}
resource "aws_lambda_function" "probe"{function_name="praest-probe-${var.region}" role=aws_iam_role.probe.arn runtime="nodejs22.x" handler="index.handler" s3_bucket=var.artifact_bucket s3_key=var.artifact_key timeout=50 memory_size=256 environment{variables={PRAEST_API_URL=var.praest_api_url,PRAEST_INTERNAL_TOKEN=var.praest_internal_token}}}
resource "aws_cloudwatch_event_rule" "minute"{name="praest-probe-minute-${var.region}" schedule_expression="rate(1 minute)"}
resource "aws_cloudwatch_event_target" "probe"{rule=aws_cloudwatch_event_rule.minute.name target_id="praest-probe" arn=aws_lambda_function.probe.arn}
resource "aws_lambda_permission" "events"{statement_id="AllowEventBridge" action="lambda:InvokeFunction" function_name=aws_lambda_function.probe.function_name principal="events.amazonaws.com" source_arn=aws_cloudwatch_event_rule.minute.arn}
