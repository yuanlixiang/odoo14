import requests

url = "http://10.190.234.70:8000/PSIGW/PeopleSoftServiceListeningConnector/G_GET_KQ_JB.1.wsdl"
r = {
    'company': '业务单位编码',
    'bdt': '开始时间',
    'edt': '结束时间'
}

response = requests.post(url, data=r)

print(response.text)
