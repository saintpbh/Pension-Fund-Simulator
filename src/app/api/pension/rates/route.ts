import { NextRequest, NextResponse } from 'next/server';
import { query as runQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = `
      SELECT 
        TRIM(YY) AS YY,
        ISNULL(DefaultPay, 0) AS DefaultPay,
        ISNULL(LessCont, 0) AS LessCont,
        ISNULL(OverCont, 0) AS OverCont,
        ISNULL(Share, 0) AS Share,
        TRIM(Remark) AS Remark,
        ISNULL(Lev1_Kamt, 0) AS Lev1_Kamt,
        ISNULL(Lev1_Bamt, 0) AS Lev1_Bamt,
        ISNULL(Lev2_Kamt, 0) AS Lev2_Kamt,
        ISNULL(Lev2_Bamt, 0) AS Lev2_Bamt,
        ISNULL(Lev3_Kamt, 0) AS Lev3_Kamt,
        ISNULL(Lev3_Bamt, 0) AS Lev3_Bamt,
        ISNULL(Lev4_Kamt, 0) AS Lev4_Kamt,
        ISNULL(Lev4_Bamt, 0) AS Lev4_Bamt
      FROM TB_PEN904
      ORDER BY YY DESC
    `;
    
    const result = await runQuery(sql);
    return NextResponse.json({ success: true, data: result.recordset });
  } catch (error: any) {
    console.error('API Error: GET /api/pension/rates -', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
