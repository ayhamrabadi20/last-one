import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { requireDatabase } from "@/lib/mongodb";
import { apiError } from "@/lib/schemas";
export async function GET(request:Request) {
  const session=await sessionFromRequest(request);
  if(!session)return NextResponse.json(apiError("UNAUTHORIZED","سجّل الدخول لحفظ تفضيلاتك."),{status:401});
  try {const account=await (await requireDatabase()).collection("accounts").findOne({$or:[{email:session.sub},{username:session.sub}]},{projection:{theme:1}});return NextResponse.json({theme:account?.theme||"system"});}
  catch{return NextResponse.json(apiError("STORAGE_UNAVAILABLE","تعذر تحميل المظهر."),{status:503});}
}
export async function PATCH(request:Request) {
  const session=await sessionFromRequest(request);
  if(!session)return NextResponse.json(apiError("UNAUTHORIZED","سجّل الدخول لحفظ تفضيلاتك."),{status:401});
  const parsed=z.object({theme:z.enum(["light","dark","system"])}).safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json(apiError("INVALID_THEME","خيار المظهر غير صالح."),{status:400});
  try {const result=await (await requireDatabase()).collection("accounts").updateOne({$or:[{email:session.sub},{username:session.sub}]},{$set:{theme:parsed.data.theme}});if(!result.matchedCount)return NextResponse.json(apiError("NOT_FOUND","الحساب غير موجود."),{status:404});return NextResponse.json({theme:parsed.data.theme});}
  catch{return NextResponse.json(apiError("STORAGE_UNAVAILABLE","تعذر حفظ المظهر في الحساب."),{status:503});}
}
