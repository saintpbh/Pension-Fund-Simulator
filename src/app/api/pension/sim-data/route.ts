import { NextRequest, NextResponse } from 'next/server';
import { query as runQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const sql = `
      -- 1) 실제 2026년 5월 수급자 그룹
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
        END AS RealRetireAge,
        1 AS IsRecipient,
        r.PayType AS LastPayType,
        r.Amt AS LastPayAmt
      FROM TB_PEN360 r
      INNER JOIN TB_PEN100 p ON r.PenNo = p.PenNo
      INNER JOIN TB_Chr200 m ON p.MemberCode = m.MinisterCode
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
      WHERE r.YM = '202605'

      UNION ALL

      -- 2) 2026년 5월 수급자가 아닌 회원 중 현직 목회자 그룹 (사망자 제외)
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
        END AS RealRetireAge,
        0 AS IsRecipient,
        NULL AS LastPayType,
        NULL AS LastPayAmt
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
        AND (p.PenNo IS NULL OR p.PenNo NOT IN (
          SELECT PenNo FROM TB_PEN360 WHERE YM = '202605'
        ))
        AND (m.EndDate IS NULL OR m.EndDate = '' OR m.EndDate = '        ')
    `;
    
    const result = await runQuery(sql);

    return NextResponse.json({ success: true, data: result.recordset });
  } catch (error: any) {
    console.error('API Error: GET /api/pension/sim-data -', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

