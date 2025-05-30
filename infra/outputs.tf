output "cluster_name" {
  description = "GKE Cluster Name"
  value       = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  description = "GKE Cluster Endpoint"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "cluster_location" {
  description = "GKE Cluster Location"
  value       = google_container_cluster.primary.location
}

output "node_pool_zones" {
  description = "Zones where node pool instances can be created"
  value       = var.zones
}

output "get_credentials_command" {
  description = "Command to get cluster credentials"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --zone ${google_container_cluster.primary.location} --project emubench-459802"
}

output "node_pool_service_account_email" {
  description = "Email of the node pool service account"
  value       = google_service_account.gke_node_pool_sa.email
}

output "workload_service_account_email" {
  description = "Email of the workload service account"
  value       = google_service_account.emubench_workload_sa.email
}

output "kubernetes_service_account_name" {
  description = "Name of the Kubernetes service account"
  value       = kubernetes_service_account.emubench_serv.metadata[0].name
}

output "node_pool_name" {
  description = "Name of the spot node pool (handles all workloads)"
  value       = google_container_node_pool.arm_spot_nodes.name
}

output "node_pool_taints" {
  description = "Taints applied to nodes - use these in tolerations"
  value = [
    "architecture=arm64:NoSchedule"
  ]
}

output "workload_deployment_notes" {
  description = "Important notes for deploying workloads"
  value = <<-EOT
    All workloads run on spot instances. Your pods need:
    1. Toleration for architecture=arm64:NoSchedule
    2. ARM64-compatible container images
    3. Graceful handling of spot instance preemption (30s warning)
    4. Consider using Deployments with multiple replicas for high availability
  EOT
}
