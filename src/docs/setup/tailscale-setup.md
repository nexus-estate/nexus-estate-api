# Tailscale Setup Guide for Team Access

This guide covers installing and configuring Tailscale on the k3s VM to provide secure VPN access for the development team.

## Overview

Tailscale creates a WireGuard-based mesh VPN that allows team members to securely access the k3s cluster from anywhere. Each team member needs to install the Tailscale client on their development machine.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Tailscale Network                       │
│                                                             │
│  ┌─────────────┐                                            │
│  │  k3s VM     │  tailscale IP: 100.x.x.x                  │
│  │  (tailscale) │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│  └─────────────┘  subnet routes: 192.168.1.0/24          ┃ │
│                                                           ┃ │
│  ┌─────────────┐                                          ┃ │
│  │  Dev Laptop  │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│  │  (tailscale) │  direct peer-to-peer connection          │
│  └─────────────┘  no open firewall ports needed             │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- A [Tailscale account](https://login.tailscale.com/) (free tier supports up to 3 users)
- Ubuntu 24.04 LTS VM with internet access
- `curl` installed

## Step 1: Install Tailscale on the k3s VM

```bash
# Install Tailscale using the official script
curl -fsSL https://tailscale.com/install.sh | sudo sh

# Enable and start Tailscale
sudo systemctl enable --now tailscaled

# Authenticate with your Tailscale account
sudo tailscale up

# A URL will be printed. Open it in a browser, log in with your Tailscale account.
# After authentication, the VM will appear in your Tailscale network.

# Verify the connection
tailscale status
```

The output should show your VM with an IP address in the `100.x.x.x` range.

## Step 2: Enable Subnet Routing (Access k3s Services)

If team members need to access the k3s cluster directly (not just through Tailscale), enable subnet routing:

```bash
# Enable IP forwarding (already done for k3s, but ensure it's on)
sudo sysctl net.ipv4.ip_forward=1

# Advertise the local subnet routes (adjust for your network)
sudo tailscale up --advertise-routes=192.168.1.0/24 --accept-routes

# If you want to advertise the k3s service CIDR as well
sudo tailscale up --advertise-routes=192.168.1.0/24,10.43.0.0/16
```

> **Note**: After advertising routes, go to the [Tailscale Admin Console](https://login.tailscale.com/admin/machines), find your VM, and click **... > Edit Route Settings** to approve the advertised routes.

## Step 3: Install Tailscale on Team Members' Machines

### macOS

```bash
brew install tailscale
# Or download from https://tailscale.com/download/mac
```

### Windows

Download from https://tailscale.com/download/windows

### Linux

```bash
curl -fsSL https://tailscale.com/install.sh | sudo sh
sudo tailscale up
```

## Step 4: Access the k3s Cluster via Tailscale

Once Tailscale is set up on both the VM and team members' machines:

### Option A: Direct Access (Recommended)

Team members can use the Tailscale IP directly in their `kubeconfig`:

```bash
# On the k3s VM, get the Tailscale IP
tailscale ip -4

# On the team member's machine, replace the server IP in kubeconfig
# The Tailscale IP should be something like 100.x.x.x
sudo sed -i 's/127.0.0.1/<TAILSCALE_IP>/g' ~/.kube/config
```

### Option B: SSH Tunnel via Tailscale

```bash
# Team member can SSH to the VM via Tailscale
ssh nexus@<TAILSCALE_IP>

# Then use kubectl on the VM
kubectl get pods -A
```

### Option C: Expose Argo CD Web UI

```bash
# Expose the Argo CD server via a NodePort or LoadBalancer
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort"}}'

# Get the NodePort
kubectl get svc argocd-server -n argocd -o jsonpath='{.spec.ports[0].nodePort}'

# Access via Tailscale IP: http://<TAILSCALE_IP>:<NODE_PORT>
```

## Step 5: Configure MagicDNS (Optional but Recommended)

Enable MagicDNS in the [Tailscale DNS settings](https://login.tailscale.com/admin/dns):

1. Go to **DNS** tab in the admin console
2. Enable **MagicDNS** (this gives your machines hostnames like `machine-name.tailscale.com`)
3. Enable **HTTPS Certificates** if you want TLS for internal services

Now you can access services using hostnames instead of IPs:

```bash
# Instead of IP
ssh nexus@<TAILSCALE_IP>
# Use hostname
ssh nexus@k3s-server.tailscale.com
```

## Step 6: Configure ACLs (Access Control)

Tailscale allows fine-grained access control via ACLs. Example ACL configuration:

```json
// From the Tailscale Admin Console > Access Controls
{
  "acls": [
    // Allow all users to access all machines (wide open for development)
    {"action": "accept", "src": ["*"], "dst": ["*:*"]}
  ],
  // More restrictive example for production:
  // "groups": {
  //   "dev": ["email1@example.com", "email2@example.com"],
  //   "ops": ["email3@example.com"]
  // },
  // "acls": [
  //   // Devs can access k3s server and SSH
  //   {"action": "accept", "src": ["group:dev"], "dst": ["100.x.x.x:22", "100.x.x.x:443", "100.x.x.x:6443"]},
  //   // Ops can access everything
  //   {"action": "accept", "src": ["group:ops"], "dst": ["*:*"]}
  // ]
}
```

## Security Considerations

1. **Tailscale SSH** (instead of OpenSSH):
   ```bash
   sudo tailscale up --ssh
   ```
   This replaces SSH keys with Tailscale-based authentication and uses short-lived certificates.

2. **Firewall**: Even with Tailscale, it's good practice to block non-Tailscale access:
   ```bash
   sudo ufw default deny incoming
   sudo ufw allow in on tailscale0
   sudo ufw enable
   ```

3. **API Server Lockdown**: Ensure the k3s API server only listens on the Tailscale interface:
   ```bash
   # Edit k3s service
   sudo nano /etc/systemd/system/k3s.service
   # Add --advertise-address=<TAILSCALE_IP> to ExecStart
   ```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't ping the Tailscale IP | Check `tailscale status` on both machines. Verify authentication. |
| Subnet routes not working | In Tailscale Admin Console, approve advertised routes. |
| Slow connection | Tailscale uses direct peer-to-peer by default. Check if DERP relay is being used: `tailscale status --json \| grep "Relay"` |
| Team member can't join | Ensure the free tier limit (3 users) or your plan limits aren't exceeded. |

## Next Steps

Now that the team has secure VPN access to the k3s cluster, proceed to [install Argo CD](./argocd-installation.md) for GitOps-based deployments.