import { NextRequest, NextResponse } from 'next/server';
import { query as runQuery } from '@/lib/db';
import mssql from 'mssql';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ penNo: string }> }
) {
  try {
    const { penNo } = await params;
    
    // 1. 요약 정보 조회
    const summarySql = `
      SELECT 
        TRIM(p.PenNo) AS PenNo,
        TRIM(p.MemberCode) AS MemberCode,
        TRIM(p.MemberName) AS MemberName,
        TRIM(p.EndDate) AS EndDate,
        TRIM(m.BirthDay) AS BirthDay,
        TRIM(m.AnsuDate) AS AnsuDate,
        TRIM(m.Tel_Mobile) AS Tel_Mobile,
        TRIM(c.ChrName) AS ChrName,
        TRIM(n.NohName) AS NohName,
        ISNULL(s.Lev1_Cnt, 0) AS Lev1_Cnt,
        ISNULL(s.Lev2_Cnt, 0) AS Lev2_Cnt,
        ISNULL(s.Lev3_Cnt, 0) AS Lev3_Cnt,
        ISNULL(s.Lev4_Cnt, 0) AS Lev4_Cnt,
        ISNULL(s.Amt, 0) AS Amt,
        ISNULL(s.RetirementAge, 70) AS RetirementAge
      FROM TB_PEN100 p
      LEFT JOIN TB_Chr200 m ON p.MemberCode = m.MinisterCode
      LEFT JOIN TB_Chr201 h ON m.MinisterCode = h.MinisterCode AND (h.TradeDate IS NULL OR h.TradeDate = '')
      LEFT JOIN TB_Chr100 c ON h.ChrCode = c.ChrCode
      LEFT JOIN TB_Chr910 n ON c.NohCode = n.NohCode
      LEFT JOIN TB_PEN350 s ON p.PenNo = s.PenNo
      WHERE p.PenNo = @penNo
    `;
    
    const summaryResult = await runQuery(summarySql, [
      { name: 'penNo', type: mssql.Char(6), value: penNo }
    ]);
    
    if (summaryResult.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Pension subscriber not found' }, { status: 404 });
    }
    
    const summary = summaryResult.recordset[0];
    
    // 2. 납입 이력 조회
    const historySql = `
      SELECT 
        TRIM(PenNo) AS PenNo,
        TRIM(YYMM) AS YYMM,
        ISNULL(inContribute, 0) AS inContribute,
        ISNULL(inShare, 0) AS inShare,
        ISNULL(inArrear, 0) AS inArrear,
        TRIM(Finish) AS Finish
      FROM TB_PEN110
      WHERE PenNo = @penNo
      ORDER BY YYMM DESC
    `;
    
    const historyResult = await runQuery(historySql, [
      { name: 'penNo', type: mssql.Char(6), value: penNo }
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        summary,
        history: historyResult.recordset
      }
    });
  } catch (error: any) {
    console.error(`API Error: GET /api/pension -`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
