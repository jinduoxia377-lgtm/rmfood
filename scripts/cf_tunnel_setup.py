import requests
import json
import sys

token = 'cfut_QNEYlQIPmwQoxwhvXkFZr3UjKemuXh2CHRGK7HXs0b890fb2'

headers = {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
}

# Try to get zones
print("Fetching zones...")
resp = requests.get('https://api.cloudflare.com/client/v4/zones', headers=headers)
print(f"Status: {resp.status_code}")

if resp.status_code == 200:
    zones = resp.json().get('result', [])
    print(f"Total zones: {len(zones)}")
    for z in zones:
        print(f"  ID: {z.get('id')}, Name: {z.get('name')}, Status: {z.get('status')}")
        
        # For agnet.ltd zone, get account info
        if 'agnet' in z.get('name', '').lower():
            account_id = z.get('account', {}).get('id')
            print(f"  Account ID: {account_id}")
            
            # Create tunnel
            print("\nCreating tunnel...")
            body = {'name': 'rmfood-tunnel'}
            tunnel_resp = requests.post(
                f'https://api.cloudflare.com/client/v4/accounts/{account_id}/tunnels',
                headers=headers,
                json=body
            )
            print(f"Tunnel Status: {tunnel_resp.status_code}")
            if tunnel_resp.status_code == 201:
                tunnel = tunnel_resp.json().get('result', {})
                print(f"Tunnel ID: {tunnel.get('id')}")
                print(f"Tunnel Name: {tunnel.get('name')}")
                print(json.dumps(tunnel, indent=2))
                sys.exit(0)
            else:
                print(f"Tunnel Error: {tunnel_resp.text}")
                sys.exit(1)
else:
    print(f"Error: {resp.text}")
    sys.exit(1)
