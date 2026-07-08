# Argo CD Installation & Configuration Guide

This guide covers installing Argo CD on the k3s cluster and configuring it to watch the Git repository for automated deployments.

## Overview

Argo CD is a GitOps tool that continuously monitors a Git repository and automatically syncs the desired state of Kubernetes manifests to the cluster. When a developer merges changes to `main`, the CI pipeline builds and pushes a new Docker image, and Argo CD detects the updated manifests and deploys them.

## Argo CD Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Developer    │     │  GitHub      │     │  Argo CD         │
│  pushes code  │────▶│  Repository  │────▶│  (k3s Cluster)   │
│  api-gateway/ │     │              │     │                  │
└──────────────┘     │  ┌─────────┐ │     │  ┌────────────┐  │
                     │  │ k8s/    │ │     │  │ Syncs to   │  │
                     │  │ manifests│ │     │  │ k3s        │  │
                     │  └─────────┘ │     │  └────────────┘  │
                     └──────────────┘     └──────────────────┘
                              │                       │
                              ▼                       ▼
                     ┌──────────────┐     ┌──────────────────┐
                     │  CI Pipeline │     │  Deployed Pods   │
                     │  Builds      │     │  (api-gateway)   │
                     │  & pushes    │     │                  │
                     │  Docker img  │     │                  │
                     └──────────────┘     └──────────────────┘
                              │
                              ▼
                     ┌──────────────┐
                     │  GHCR        │
                     │  Container   │
                     │  Registry    │
                     └──────────────┘
```

## Prerequisites

- k3s cluster installed and running
- `kubectl` configured (see [k3s Installation Guide](./k3s-installation.md))
- Helm installed (v3+)
- Git repository with Kubernetes manifests

## Step 1: Install Argo CD

### Option A: Using the Quick Start Manifest

```bash
# Create the argocd namespace
kubectl create namespace argocd

# Apply the official Argo CD installation manifest
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all pods to be ready
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
```

### Option B: Using Helm (Recommended)

```bash
# Add the Argo CD Helm repository
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

# Install Argo CD with custom values
cat <<EOF > argocd-values.yaml
server:
  ingress:
    enabled: false  # We'll use Traefik (k3s default)
  extraArgs:
    - --insecure  # Terminate TLS at the ingress level
configs:
  params:
    server.insecure: true
    # Configure the Argo CD URL for the web UI
    url: https://argocd.nexus-estate.local
EOF

helm install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  -f argocd-values.yaml \
  --version 7.x
```

## Step 2: Access the Argo CD Web UI

### Get the Initial Admin Password

```bash
# The initial password is the name of the argocd-server pod
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d; echo

# Username: admin
# Password: (output from the command above)
```

### Port-Forward to Access the UI

```bash
# Port-forward the Argo CD server to your local machine
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open in browser: https://localhost:8080
```

### Expose via Ingress (Traefik)

```bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    kubernetes.io/ingress.class: "traefik"
    traefik.ingress.kubernetes.io/router.entrypoints: web
spec:
  rules:
    - host: argocd.nexus-estate.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: argocd-server
                port:
                  number: 80
EOF
```

If using Tailscale MagicDNS, you can access Argo CD via `http://argocd.nexus-estate.local` (add the hostname to your local DNS or use MagicDNS).

## Step 3: Install Argo CD CLI

```bash
# Download the latest Argo CD CLI
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64

# Install it to /usr/local/bin
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd
rm argocd-linux-amd64

# Verify installation
argocd version --client
```

### Login via CLI

```bash
# Login using port-forward
argocd login localhost:8080 \
  --username admin \
  --password $(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d) \
  --insecure

# Change the password
argocd account update-password
```

## Step 4: Configure GitHub Repository Access

### Option A: SSH Key (Recommended)

```bash
# Generate an SSH key pair for Argo CD
ssh-keygen -t ed25519 -C "argocd@nexus-estate" -f argocd-ssh-key -N ""

# Add the public key to GitHub:
#   GitHub Repository > Settings > Deploy Keys > Add deploy key
#   Paste the content of argocd-ssh-key.pub
#   Check "Allow write access"

# Add the private key to Argo CD as a repository credential
argocd repo add git@github.com:tiesn/nexus-estate.git \
  --name nexus-estate \
  --ssh-private-key-path ./argocd-ssh-key

# Clean up local keys
rm argocd-ssh-key argocd-ssh-key.pub
```

### Option B: HTTPS with Access Token

```bash
# Create a GitHub Personal Access Token:
#   GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens
#   Repository access: Only select repositories > nexus-estate
#   Permissions: Contents (Read-only), Metadata (Read-only)

argocd repo add https://github.com/tiesn/nexus-estate.git \
  --name nexus-estate \
  --username <YOUR_GITHUB_USERNAME> \
  --password <GITHUB_TOKEN>
```

### Option C: Using the Argo CD Application Manifest (GitOps)

Instead of using the CLI, you can create the Argo CD Application manifest directly. This is the GitOps way:

```bash
# The Application manifest is already created at:
# api-gateway/k8s/argocd/application.yaml

# Apply it to the cluster
kubectl apply -f api-gateway/k8s/argocd/application.yaml --namespace=argocd

# Check the application status
argocd app get api-gateway

# Sync the application manually (first time)
argocd app sync api-gateway
```

## Step 5: Configure GHCR Image Pull Secret

Argo CD deploys the application, but k3s needs credentials to pull images from GHCR:

```bash
# Create a GitHub Personal Access Token with 'packages:read' and 'packages:write' scopes
kubectl create secret docker-registry ghcr-secret \
  --namespace=nexus-estate \
  --docker-server=ghcr.io \
  --docker-username=<YOUR_GITHUB_USERNAME> \
  --docker-password=<GITHUB_TOKEN> \
  --docker-email=<YOUR_EMAIL>
```

## Step 6: Verify the Deployment

```bash
# Check the application in Argo CD
argocd app list
argocd app get api-gateway

# Check the deployed Kubernetes resources
kubectl get all -n nexus-estate

# Check the application health in the Argo CD UI
# Open: https://argocd.nexus-estate.local
```

## Step 7: Configure Automated Sync (Production)

By default, the application manifest has automatic sync enabled. If you need to adjust:

```bash
# Enable auto-sync via CLI
argocd app set api-gateway --sync-policy automated --self-heal --prune

# Or update the application.yaml manifest
```

## Managing Argo CD

### Common CLI Commands

```bash
# List applications
argocd app list

# Get application details
argocd app get api-gateway

# Sync manually
argocd app sync api-gateway

# View sync status
argocd app wait api-gateway --health

# Rollback to a previous version
argocd app rollback api-gateway <DEPLOYMENT_ID>

# View logs
argocd app logs api-gateway

# Delete application (does not delete the namespace)
argocd app delete api-gateway
```

### Update Admin Password

```bash
argocd account update-password
```

### Add Additional Users

```bash
# Create a new role and user via the Argo CD ConfigMap
kubectl edit configmap argocd-cm -n argocd
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Application stuck in `OutOfSync` | Check the manifests in the repo match what's deployed. Run `argocd app diff api-gateway` to see differences. |
| Image pull error (`ErrImagePull`) | Verify the `ghcr-secret` exists in the namespace. Check the GitHub token has `packages:read` scope. |
| Can't connect to GitHub repo | Check SSH key or HTTPS token. Verify the repository URL in the Application manifest. |
| Argo CD UI returns 503 | Check Argo CD pods: `kubectl get pods -n argocd`. The argocd-server might need more resources. |
| Sync failing with validation errors | Check the Kubernetes manifests are valid: `kubectl apply --dry-run=client -f k8s/base/` |

## Next Steps

Now that Argo CD is installed and configured:

1. Review the [CI/CD Pipeline Documentation](../ci-cd-pipeline.md) to understand the full workflow
2. Check out the [Kubernetes Manifests](../../../k8s) directory for the actual deployment configs
3. Proceed to the [Main Documentation](../README.md) for comprehensive overview