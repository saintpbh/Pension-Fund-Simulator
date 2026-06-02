import { NextRequest, NextResponse } from 'next/server';
import { query as runQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = `
      SELECT 
        TRIM(p.PenNo) AS PenNo,
        TRIM(p.EndDate) AS EndDate,
        TRIM(m.BirthDay) AS BirthDay,
        ISNULL(s.Lev1_Cnt, 0) + ISNULL(s.Lev2_Cnt, 0) + ISNULL(s.Lev3_Cnt, 0) + ISNULL(s.Lev4_Cnt, 0) AS PastMonths,
        ISNULL(paid.TotalPaid, 0) AS CurrentAmt,
        ISNULL(last_pay.inContribute, 0) AS LastContribute,
        ISNULL(last_pay.inShare, 0) AS LastShare,
        CASE 
          WHEN m.EndDate IS NOT NULL AND LEN(TRIM(m.EndDate)) = 8 
               AND m.BirthDay IS NOT NULL AND LEN(TRIM(m.BirthDay)) = 8
          THEN CAST(SUBSTRING(m.EndDate, 1, 4) AS INT) - CAST(SUBSTRING(m.BirthDay, 1, 4) AS INT)
          ELSE NULL 
        END AS RealRetireAge
      FROM TB_Chr200 m
      LEFT JOIN TB_PEN100 p ON m.MinisterCode = p.MemberCode
      LEFT JOIN TB_PEN350 s ON p.PenNo = s.PenNo
      LEFT JOIN (
        SELECT PenNo, SUM(inContribute + inShare + inArrear) AS TotalPaid
        FROM TB_PEN110
        GROUP BY PenNo
      ) paid ON p.PenNo = paid.PenNo
      LEFT JOIN (
        SELECT PenNo, inContribute, inShare
        FROM (
          SELECT 
            PenNo, 
            inContribute, 
            inShare,
            ROW_NUMBER() OVER (PARTITION BY PenNo ORDER BY YYMM DESC) as RowNum
          FROM TB_PEN110
        ) t
        WHERE RowNum = 1
      ) last_pay ON p.PenNo = last_pay.PenNo
      WHERE (m.DelGu IS NULL OR m.DelGu <> 'D')
        AND (m.DeathDate IS NULL OR m.DeathDate = '' OR m.DeathDate = '        ')
        AND (
          -- 현직 목회자 (전체)
          (m.EndDate IS NULL OR m.EndDate = '' OR m.EndDate = '        ')
          OR 
          -- 은퇴 목회자 중 연금 수급자 (납입 1회 이상)
          ((m.EndDate IS NOT NULL AND m.EndDate <> '' AND m.EndDate <> '        ') 
           AND p.PenNo IS NOT NULL 
           AND (ISNULL(s.Lev1_Cnt, 0) + ISNULL(s.Lev2_Cnt, 0) + ISNULL(s.Lev3_Cnt, 0) + ISNULL(s.Lev4_Cnt, 0) > 0 OR ISNULL(paid.TotalPaid, 0) > 0))
        )
    `;
    
    const result = await runQuery(sql);

    return NextResponse.json({ success: true, data: result.recordset });
  } catch (error: any) {
    console.error('API Error: GET /api/pension/sim-data -', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
