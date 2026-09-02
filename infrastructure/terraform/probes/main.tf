terraform { required_providers { aws = { source = "hashicorp/aws", version = "~> 6.0" } } }
variable "regions" { type=list(string); default=["us-east-1","eu-west-1","ap-southeast-1","sa-east-1","ap-northeast-1"] }
variable "artifact_bucket" { type=string }
variable "artifact_key" { type=string }
variable "praest_api_url" { type=string }
variable "praest_internal_token" { type=string; sensitive=true }
module "probe" { for_each=toset(var.regions); source="./region"; region=each.value; artifact_bucket=var.artifact_bucket; artifact_key=var.artifact_key; praest_api_url=var.praest_api_url; praest_internal_token=var.praest_internal_token }
