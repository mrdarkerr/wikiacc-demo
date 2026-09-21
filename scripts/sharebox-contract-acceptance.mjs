import { execFileSync } from 'node:child_process';
import { readFileSync,rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
// Only run against a disposable ShareBox instance with synthetic fixtures.
assert(process.argv[2], 'Pass the private disposable fixture directory');
const root=resolve(process.argv[2]);
const backend=resolve(dirname(fileURLToPath(import.meta.url)), '../backend');
const fixture=JSON.parse(readFileSync(root+'/fixture.json'));
const upstream=new URL(fixture.baseUrl);
assert(['127.0.0.1','localhost'].includes(upstream.hostname), 'Only isolated loopback ShareBox fixtures are allowed');
const db=`${root}/contract-${process.pid}.db`;
Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:`file:${db}`,JWT_SECRET:'isolated-contract-test-jwt-secret',SMS_CONFIG_ENCRYPTION_KEY:'isolated-contract-test-encryption-secret',SHAREBOX_BASE_URL:fixture.baseUrl,COOKIE_SECURE:'false',JIBIT_ENABLED:'false'});
execFileSync(process.execPath,[backend+'/scripts/apply-schema.js'],{cwd:backend,env:process.env,stdio:'pipe'});
const {buildApp}=await import(backend+'/src/app.js');
const {createShareboxClient}=await import(backend+'/src/modules/sharebox/client.js');
const {runShareboxFulfillmentBatch}=await import(backend+'/src/modules/sharebox/fulfillment.js');
let loseResponse=true; const requests=[];
const client=createShareboxClient({baseUrl:fixture.baseUrl,nodeEnv:'test',fetchImpl:async(url,options)=>{
 const response=await fetch(url,options);
 if(options.method==='POST'){
  requests.push(JSON.parse(options.body));
  if(loseResponse){loseResponse=false;assert.equal(response.status,201);await response.json();throw new TypeError('synthetic response loss AFTER actual commit');}
 }
 return response;
}});
const purchases=new Map();let seq=0;
const jibitClient={createPurchase:async(input)=>{const purchaseId=String(++seq);purchases.set(purchaseId,{...input,purchaseId,purchaseIdStr:purchaseId,status:'PENDING'});return{purchaseId,redirectUrl:`https://napi.jibit.ir/ppg/v3/purchases/${purchaseId}/payments`};},verifyPurchase:async(id)=>({status:purchases.get(String(id)).status}),getPurchase:async(id)=>purchases.get(String(id))};
const app=await buildApp({logger:false,shareboxClient:client,shareboxWorkerOptions:{enabled:false},smsQueueOptions:{enabled:false},jibitClient,jibitCallbackUrl:'http://localhost:4301/api/v1/payments/jibit/callback',enableJibitReconciliation:false});
await app.ready();
const admin=await app.prisma.user.create({data:{name:'Contract admin',role:'ADMIN'}});
const customer=await app.prisma.user.create({data:{name:'Contract customer',phone:'09120000003',wallet:{create:{balance:10000}}}});
const cookie=user=>`wikiacc_session=${app.jwt.sign({id:user.id,role:user.role})}`;
async function call(method,url,payload,user=admin,status=200){const r=await app.inject({method,url:'/api/v1'+url,headers:{cookie:cookie(user)},...(payload===undefined?{}:{payload})});assert.equal(r.statusCode,status,`${method} ${url} ${r.json()?.error?.code??''}`);return r.json().data;}
async function licenseCount(reference){const r=await fetch(fixture.baseUrl+'/api/v1/admin/licenses?search='+reference,{headers:{authorization:'Bearer '+fixture.adminToken}});assert.equal(r.status,200);return(await r.json()).meta.total;}
try{
 await call('PATCH','/admin/sharebox/settings',{enabled:true,apiKey:fixture.apiKey});
 const {product}=await call('POST','/admin/products',{title:'Contract product',slug:'contract-product',type:'SHAREBOX',price:100,shareboxCategoryId:fixture.category.id},admin,201);
 const {order}=await call('POST','/orders',{productId:product.id,quantity:1},customer,201);
 const before=await runShareboxFulfillmentBatch(app.prisma,client);assert.equal(before.retried,1);
 const job=await app.prisma.shareboxFulfillment.findFirst({where:{orderItem:{orderId:order.id}}});
 assert.equal(await licenseCount(job.reference),1);assert.equal(await app.prisma.orderDelivery.count(),0);
 assert.equal((await app.prisma.order.findUnique({where:{id:order.id}})).paymentStatus,'PAID');
 await app.prisma.user.update({where:{id:customer.id},data:{name:'Edited later',phone:'09120000004'}});
 await app.prisma.product.update({where:{id:product.id},data:{title:'Edited product'}});
 await call('POST','/admin/orders/'+order.id+'/sharebox/retry',{});
 const retried=await runShareboxFulfillmentBatch(app.prisma,client);assert.equal(retried.delivered,1);
 assert.deepEqual(requests[0],requests[1]);assert.equal(await licenseCount(job.reference),1);assert.equal(await app.prisma.orderDelivery.count(),1);
 console.log('PASS actual ShareBox committed response lost -> PAID/RETRY -> immutable exact replay after profile edit -> ONE actual license/delivery');
 const {order:direct}=await call('POST','/orders',{productId:product.id,quantity:2,paymentMethod:'JIBIT'},customer,201);
 assert.equal((await runShareboxFulfillmentBatch(app.prisma,client)).claimed,0);
 const attempt=await app.prisma.paymentAttempt.findFirst({where:{orderId:direct.id}});
 purchases.get(attempt.providerPurchaseId).status='SUCCESSFUL';
 await call('POST',`/payments/jibit/orders/${direct.id}/verify`,{},customer);
 await call('POST',`/payments/jibit/orders/${direct.id}/verify`,{},customer);
 const delivered=await runShareboxFulfillmentBatch(app.prisma,client);assert.equal(delivered.delivered,2);
 const {order:done}=await call('GET','/orders/'+direct.id,undefined,customer);assert.equal(done.status,'DELIVERED');assert.equal(done.items[0].deliveries.length,2);
 const ref='WKA-'+direct.id.slice(-6).toUpperCase();assert.equal(await licenseCount(ref),2);
 console.log('PASS simulated verified Jibit payment + REAL ShareBox: unpaid no issuance, repeated verification safe, quantity2 delivery');
}finally{await app.close();rmSync(db,{force:true});}
