import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';
import { createApiKeySecret, hashApiKey, keyPrefix } from '../../../../../lib/integrations';

async function session() { return getServerSession(authOptions); }
export async function GET() {
  const s = await session(); if (!s?.user?.organizationId) return NextResponse.json({ error:'Unauthorized' },{status:401});
  const keys = await prisma.apiKey.findMany({ where:{ organizationId:s.user.organizationId }, select:{id:true,name:true,keyPrefix:true,lastUsedAt:true,expiresAt:true,revokedAt:true,createdAt:true}, orderBy:{createdAt:'desc'} });
  return NextResponse.json(keys);
}
export async function POST(req: NextRequest) {
  const s=await session(); if(!s?.user?.organizationId || !['ADMIN','MANAGER'].includes(s.user.role||'')) return NextResponse.json({error:'Admin or manager access required.'},{status:403});
  const org=await prisma.organization.findUnique({where:{id:s.user.organizationId},select:{id:true,plan:true,_count:{select:{apiKeys:true}}}});
  const limits:any={STARTER:2,GROWTH_PRO:10,ENTERPRISE:50}; if(org && org._count.apiKeys >= (limits[org.plan] ?? 10)) return NextResponse.json({error:`Your ${org.plan} plan has reached its API key limit.`},{status:403});
  const body=await req.json(); const name=String(body.name||'').trim(); if(!name)return NextResponse.json({error:'Name is required.'},{status:400});
  const secret=createApiKeySecret(); const key=await prisma.apiKey.create({data:{organizationId:s.user.organizationId,name,keyPrefix:keyPrefix(secret),keyHash:hashApiKey(secret),expiresAt:body.expiresAt?new Date(body.expiresAt):null}});
  return NextResponse.json({id:key.id,name:key.name,key:secret,warning:'Copy this key now. The full secret will not be shown again.'},{status:201});
}
export async function DELETE(req: NextRequest) {
  const s=await session(); if(!s?.user?.organizationId || !['ADMIN','MANAGER'].includes(s.user.role||'')) return NextResponse.json({error:'Admin or manager access required.'},{status:403});
  const id=new URL(req.url).searchParams.get('id'); if(!id)return NextResponse.json({error:'Key id is required.'},{status:400});
  await prisma.apiKey.updateMany({where:{id,organizationId:s.user.organizationId},data:{revokedAt:new Date()}}); return NextResponse.json({success:true});
}
