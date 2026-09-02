import httpx
class PraestClient:
    def __init__(self,base_url:str,api_key:str|None=None,access_token:str|None=None,timeout:float=30):
        self.base_url=base_url.rstrip('/');self.headers={"content-type":"application/json"};
        if api_key:self.headers["authorization"]=f"PraestKey {api_key}"
        elif access_token:self.headers["authorization"]=f"Bearer {access_token}"
        self.client=httpx.Client(base_url=self.base_url,headers=self.headers,timeout=timeout)
    def _request(self,method,path,**kwargs):
        r=self.client.request(method,f"/v1/{path.lstrip('/')}",**kwargs);r.raise_for_status();return r.json() if r.content else None
    def list(self,resource):return self._request('GET',f'resources/{resource}')
    def get(self,resource,id):return self._request('GET',f'resources/{resource}/{id}')
    def create(self,resource,data):return self._request('POST',f'resources/{resource}',json=data)
    def create_agreement(self,data):return self._request('POST','agreements',json=data)
    def create_resolution(self,data):return self._request('POST','resolutions',json=data)
    def adjudicate(self,case_id):return self._request('POST',f'cases/{case_id}/adjudicate')
    def start_case_workflow(self,case_id):return self._request('POST',f'workflows/cases/{case_id}')
    def appeal(self,adjudication_id,reason,value=None):return self._request('POST',f'adjudications/{adjudication_id}/appeal',json={'reason':reason,'value':value})
    def finalize(self,adjudication_id):return self._request('POST',f'adjudications/{adjudication_id}/finalize')
    def routes(self):return self._request('GET','routes')
    def verify_settle_x402(self,data):return self._request('POST','x402/verify-settle',json=data)
    def export_to_internet_court(self,case_id,data=None):return self._request('POST',f'internet-court/cases/{case_id}/export',json=data or {})
    def close(self):self.client.close()
