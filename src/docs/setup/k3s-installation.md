# k3s Installation Guide

This guide covers installing a lightweight Kubernetes cluster using k3s on the Ubuntu VM.

## Overview

k3s is a CNCF-certified Kubernetes distribution designed for resource-constrained environments. It bundles everything needed to run Kubernetes into a single binary under 50 MB.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    k3s Server (Control Plane)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  kube-apiserver│ │  kube-scheduler│ │  kube-controller-man│ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  etcd (or SQLite)│ │  kube-proxy │ │  containerd         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │  CoreDNS    │  │  Traefik    │  (Ingress Controller)     │
│  └─────────────┘  └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Ubuntu 24.04 LTS VM with:
  - Minimum 2 GB RAM (4 GB+ recommended)
  - 2 vCPUs
  - 20 GB disk space
  - Swap disabled
  - Kernel modules loaded (overlay, br_netfilter)
  - Network forwarding enabled
- Root or sudo access

## Step 1: Install k3s Server

SSH into the VM and run:

```bash
# Install k3s (latest stable)
curl -sfL https://get.k3s.io | sh -

# Check the status of k3s
sudo systemctl status k3s

# Check that all nodes are ready
sudo k3s kubectl get nodes
```

### Options for the Install Script

You can customize the installation with environment variables:

```bash
# Install with specific options:
curl -sfL https://get.k3s.io | \
  INSTALL_K3S_EXEC="--disable=traefik --write-kubeconfig-mode=644" \
  sh -
```

- `--disable=traefik`: Skip the default Traefik ingress controller (if you want to use your own)
- `--write-kubeconfig-mode=644`: Allow non-root users to use kubectl
- `--cluster-cidr=10.42.0.0/16`: Custom Pod CIDR range (default)
- `--service-cidr=10.43.0.0/16`: Custom Service CIDR range (default)

## Step 2: Configure kubectl for Non-root User

```bash
# Copy kubeconfig to your user directory
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config

# Set KUBECONFIG environment variable permanently
echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
source ~/.bashrc

# Test kubectl
kubectl get nodes
kubectl get pods --all-namespaces
```

## Step 3: Verify the Cluster

```bash
# List all nodes
kubectl get nodes -o wide

# List all pods across all namespaces
kubectl get pods -A

# Check system components
kubectl get pods -n kube-system

# Check cluster info
kubectl cluster-info

# Check storage classes
kubectl get storageclass
```

Expected output should show:

- 1 node in `Ready` state (or more if you joined workers)
- System pods in `kube-system` namespace running (coredns, local-path-provisioner, metrics-server, traefik)
- A default `local-path` storage class

## Step 4: Install Additional Nodes (Optional)

To create a multi-node cluster, you need additional VMs or physical machines:

```bash
# On the server, get the node token
sudo cat /var/lib/rancher/k3s/server/node-token
```

On each worker node:

```bash
curl -sfL https://get.k3s.io | \
  K3S_URL=https://<SERVER_IP>:6443 \
  K3S_TOKEN=<NODE_TOKEN> \
  sh -
```

## Step 5: Install Helm (Package Manager)

```bash
# Download and install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add Helm repositories
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Verify Helm installation
helm version
```

## Step 6: Deploy a Test Application

```bash
# Create a namespace for our application
kubectl create namespace nexus-estate

# Deploy a test nginx to verify the cluster works
kubectl create deployment test-nginx --image=nginx --namespace=nexus-estate
kubectl expose deployment test-nginx --port=80 --namespace=nexus-estate

# Check that it's running
kubectl get pods -n nexus-estate
kubectl get svc -n nexus-estate

# Clean up the test
kubectl delete deployment test-nginx -n nexus-estate
kubectl delete svc test-nginx -n nexus-estate
```

## Step 7: Configure kubectl Autocompletion

```bash
# Bash completion
sudo apt install -y bash-completion
echo 'source <(kubectl completion bash)' >> ~/.bashrc
echo 'alias k=kubectl' >> ~/.bashrc
echo 'complete -o default -F __start_kubectl k' >> ~/.bashrc
source ~/.bashrc
```

## Useful k3s Commands

```bash
# Restart k3s
sudo systemctl restart k3s

# Stop k3s
sudo systemctl stop k3s

# View logs
sudo journalctl -u k3s -f

# Backup etcd (snapshot)
sudo k3s etcd-snapshot save --dir=/opt/k3s-backups

# List snapshots
sudo k3s etcd-snapshot list --dir=/opt/k3s-backups

# Restore from snapshot
sudo k3s server --cluster-reset --cluster-reset-restore-path=/opt/k3s-backups/snapshot.db
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `kubectl` not working for non-root | Check `~/.kube/config` permissions and content. Run `sudo k3s kubectl get nodes` to verify the server is running. |
| Pods stuck in `Pending` | Check node resources: `kubectl describe nodes`. You may need to add more CPU/memory to the VM. |
| DNS not working | Check CoreDNS pods: `kubectl get pods -n kube-system -l k8s-app=kube-dns` |
| Ingress not working | Check Traefik: `kubectl get pods -n kube-system -l app=traefik` |
| containerd permission issues | Add your user to the `containerd` group: `sudo usermod -aG containerd $USER` |

## Next Steps

1. [Install Tailscale for Team Access](./tailscale-setup.md)
2. [Install Argo CD](./argocd-installation.md)
3. Deploy the API gateway using `kubectl apply -k k8s/overlays/production`