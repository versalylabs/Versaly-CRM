import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';
import { getStripe } from '../../../../../lib/stripe';
export async function POST(req: NextRequest) {
 const session=await getServerSession(authOptions); if(!session?.user?.id||session.user.role!=='ADMIN') return NextResponse.json({error:'Only workspace administrators can manage billing.'},{status:403});
 const orgId=session.user.organizationId; const org=orgId?await prisma.organization.findUnique({where:{id:orgId}}):null;
 if(!org?.stripeCustomerId) return NextResponse.json({error:'No Stripe customer exists for this workspace yet.'},{status:400});
 try { const stripe=getStripe(); const base=process.env.NEXTAUTH_URL||req.nextUrl.origin; const portal=await stripe.billingPortal.sessions.create({customer:org.stripeCustomerId,return_url:`${base}/settings/billing`}); return NextResponse.json({url:portal.url}); } catch(e:any){return NextResponse.json({error:e.message||'Unable to open billing portal.'},{status:500});}
}
