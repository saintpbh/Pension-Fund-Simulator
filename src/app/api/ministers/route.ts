import { NextRequest, NextResponse } from 'next/server';
import { query as runQuery } from '@/lib/db';
import mssql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('query') || '';
    
    let sql = `
      SELECT DISTINCT TOP 50
        TRIM(m.MinisterCode) AS MinisterCode,
        TRIM(m.MinisterName) AS MinisterName,
        TRIM(m.BirthDay) AS BirthDay,
        TRIM(m.AnsuDate) AS AnsuDate,
        TRIM(m.Tel_Mobile) AS Tel_Mobile,
        CASE 
          WHEN p.PenNo IS NOT NULL AND (ISNULL(s.Lev1_Cnt, 0) + ISNULL(s.Lev2_Cnt, 0) + ISNULL(s.Lev3_Cnt, 0) + ISNULL(s.Lev4_Cnt, 0) > 0 OR ISNULL(paid.TotalPaid, 0) > 0) 
          THEN TRIM(p.PenNo) 
          ELSE NULL 
        END AS PenNo,
        TRIM(c.ChrName) AS ChrName,
        TRIM(n.NohName) AS NohName
      FROM TB_Chr200 m
      LEFT JOIN TB_PEN100 p ON m.MinisterCode = p.MemberCode
      LEFT JOIN TB_PEN350 s ON p.PenNo = s.PenNo
      LEFT JOIN (
        SELECT PenNo, SUM(inContribute + inShare + inArrear) AS TotalPaid
        FROM TB_PEN110
        GROUP BY PenNo
      ) paid ON p.PenNo = paid.PenNo
      LEFT JOIN TB_Chr201 h ON m.MinisterCode = h.MinisterCode AND (h.TradeDate IS NULL OR h.TradeDate = '')
      LEFT JOIN TB_Chr100 c ON h.ChrCode = c.ChrCode
      LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
    `;
    
    const params = [];
    if (search) {
      sql += ` WHERE m.MinisterName LIKE @query OR c.ChrName LIKE @query OR n.NohName LIKE @query `;
      params.push({ name: 'query', type: mssql.NVarChar, value: `%${search}%` });
    }
    
    sql += ` ORDER BY MinisterName ASC`;
    
    const result = await runQuery(sql, params);
    return NextResponse.json({ success: true, data: result.recordset });
  } catch (error: any) {
    console.error('API Error: GET /api/ministers -', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
