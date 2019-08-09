echo "$LeftId  0.0.0.0 : PSK \"$PSK\"
" > /etc/ipsec.d/test.secrets

echo "conn test
    authby=secret
    auto=start
    left=%defaultroute
    leftsubnet=$LeftSubnet
    leftnexthop=%defaultroute
    rightid=$RightId
    right=$RightIp
    rightsubnet=$RightSubnet
    keyingtries=%forever
    ike=aes128-sha1;modp1024
    ikelifetime="28800"
    phase2alg=aes128-sha1;modp1024
    salifetime="3600"
    pfs=no
    phase2=esp
    type=tunnel
" > /etc/ipsec.d/test.conf

iptables -t mangle -A FORWARD -o eth0 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1387
