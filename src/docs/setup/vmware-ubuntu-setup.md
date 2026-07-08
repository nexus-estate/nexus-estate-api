# VMware Ubuntu Server Setup Guide

This guide walks through setting up an Ubuntu Server 24.04 LTS virtual machine on VMware Workstation/Player for use as a k3s cluster node.

## Prerequisites

- VMware Workstation 17+ or VMware Player 17+
- Ubuntu Server 24.04 LTS ISO (download from [ubuntu.com](https://ubuntu.com/download/server))
- Minimum 4 GB RAM allocated to the VM (8 GB recommended)
- Minimum 2 vCPUs
- 40 GB disk space

## Step 1: Create the Virtual Machine

1. Open VMware Workstation and select **Create a New Virtual Machine**.
2. Choose **Typical (recommended)** configuration.
3. Select **Installer disc image file (iso)** and browse to the Ubuntu Server ISO.
4. Configure:
   - **Full name**: Nexus Estate Admin
   - **Username**: `nexus`
   - **Password**: Use a strong password and store it in a password manager
   - **Hostname**: `k3s-server`
5. **Disk size**: 40 GB (enable **Split virtual disk into multiple files**)
6. **Customize Hardware**:
   - **Memory**: 8192 MB (8 GB)
   - **Processors**: 4 CPU cores
   - **Network Adapter**: NAT (we'll configure Tailscale later for team access)

## Step 2: Install Ubuntu Server

1. Boot the VM and follow the Ubuntu Server installer prompts.
2. **Network connections**: The default DHCP is fine; we'll assign a static IP later.
3. **Configure proxy**: Leave blank unless your network requires a proxy.
4. **Ubuntu archive mirror**: Select your closest location.
5. **Guided storage configuration**: Use default (use entire disk with LVM).
6. **Profile setup**: Use the credentials configured above.
7. **SSH Setup**: Select **Install OpenSSH server**.
8. **Featured Server Snaps**: Skip (we'll install Docker/k3s manually).
9. Complete the installation and reboot.

## Step 3: Post-Installation Configuration

SSH into the VM (or use the console) and run:

```bash
# Update all packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates

# Disable swap (required for k3s)
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Enable kernel modules for networking
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# sysctl params required by k3s
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system
```

## Step 4: Configure Static IP Address

Assign a static IP so the cluster nodes can communicate reliably:

```bash
# Find your network interface name
ip link show

# Edit Netplan configuration
sudo nano /etc/netplan/00-installer-config.yaml
```

Example configuration:

```yaml
network:
  ethernets:
    ens33:
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 1.1.1.1
  version: 2
```

Apply the configuration:

```bash
sudo netplan apply
```

## Step 5: Install Docker (Optional — for building images locally)

```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to the docker group (avoid sudo)
sudo usermod -aG docker $USER
newgrp docker
```

## Verification

After completing these steps, verify the system is ready:

```bash
# Check kernel modules
lsmod | grep -E "overlay|br_netfilter"

# Check sysctl params
sysctl net.bridge.bridge-nf-call-iptables net.bridge.bridge-nf-call-ip6tables net.ipv4.ip_forward

# Check swap is disabled
swapon --show

# Check Docker (if installed)
docker --version
docker run hello-world
```

## Next Steps

Proceed to the [k3s Installation Guide](./k3s-installation.md) to set up the Kubernetes cluster.