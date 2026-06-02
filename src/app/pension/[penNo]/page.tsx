'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend,
  Filler
);

interface PensionSummary {
  PenNo: string;
  MemberCode: string;
  MemberName: string;
  EndDate: string;
  BirthDay: string;
  AnsuDate: string;
  Tel_Mobile: string;
  ChrName: string | null;
  NohName: string | null;
  Lev1_Cnt: number;
  Lev2_Cnt: number;
  Lev3_Cnt: number;
  Lev4_Cnt: number;
  Amt: number;
  RetirementAge: number;
}

interface ContributionHistory {
  PenNo: string;
  YYMM: string;
  inContribute: number;
  inShare: number;
  inArrear: number;
  Finish: string;
}

export default function PensionDetailPage({ params }: { params: Promise<{ penNo: string }> }) {
  const unwrappedParams = use(params);
  const penNo = unwrappedParams.penNo;
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<PensionSummary | null>(null);
  const [history, setHistory] = useState<ContributionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 시뮬레이션 설정 상태
  const [simRetirementAge, setSimRetirementAge] = useState(70);
  const [simInterestRate, setSimInterestRate] = useState(3.0); // 연이율 %
  const [simMonthlyCont, setSimMonthlyCont] = useState(142000); // 월 본인부담금
  const [simMonthlyShare, setSimMonthlyShare] = useState(242000); // 월 교회매칭금
  const [simArrearPayment, setSimArrearPayment] = useState(0); // 소급 납입 일시금
  const [simLifeExpectancy, setSimLifeExpectancy] = useState(85); // 예상 기대수명 (연금수령 만료연령)
  const [wageGrowthRate, setWageGrowthRate] = useState(1.5); // 임금(기준급) 연상승률 %

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!penNo) return;
    
    setLoading(true);
    fetch(`/api/pension/${penNo}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setSummary(res.data.summary);
          setHistory(res.data.history);
          // DB의 은퇴 연령으로 시뮬레이션 은퇴 연령 기본값 지정
          if (res.data.summary.RetirementAge) {
            setSimRetirementAge(res.data.summary.RetirementAge);
          }
        } else {
          setError(res.error || '정보를 불러오지 못했습니다.');
        }
      })
      .catch((err) => {
        console.error(err);
        setError('서버 연결 중 오류가 발생했습니다.');
      })
      .finally(() => setLoading(false));
  }, [penNo]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '10rem 1rem', color: 'var(--text-secondary)' }}>
        <h2>연금 정보를 불러오는 중입니다...</h2>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 1rem', maxWidth: '600px', margin: '6rem auto' }}>
        <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>오류 발생</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error || '가입자 정보를 찾을 수 없습니다.'}</p>
        <Link href="/" className="btn btn-secondary">
          메인 대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  // --- 시뮬레이션 계산 로직 ---
  const birthYearStr = summary.BirthDay?.trim()?.slice(0, 4);
  const birthMonthStr = summary.BirthDay?.trim()?.slice(4, 6);
  const birthYear = birthYearStr ? parseInt(birthYearStr) : 1970;
  const birthMonth = birthMonthStr ? parseInt(birthMonthStr) : 1;

  // 은퇴 시점 연월 계산
  const retirementYear = birthYear + simRetirementAge;
  const retirementMonth = birthMonth;

  // 현재 연월 (2026년 06월 기준 고정 또는 현재 시점 계산)
  const currentYear = 2026;
  const currentMonth = 6;

  // 남은 개월 수 계산
  const remainingMonths = Math.max(
    0,
    (retirementYear - currentYear) * 12 + (retirementMonth - currentMonth)
  );

  // 현재까지 납입 개월 수 합산
  const pastMonths = (summary.Lev1_Cnt || 0) + (summary.Lev2_Cnt || 0) + (summary.Lev3_Cnt || 0) + (summary.Lev4_Cnt || 0);
  const totalProjectedMonths = pastMonths + remainingMonths;

  // 시뮬레이션 연도별 적립액 변화 계산 (차트용)
  const monthlyRate = (simInterestRate / 100) / 12;
  const monthlyContribution = simMonthlyCont + simMonthlyShare;

  let currentFund = summary.Amt || 0;
  const chartLabels: string[] = ['현재 (26년 6월)'];
  const chartDataPoints: number[] = [currentFund / 10000]; // 만원 단위

  // 매달 복리 계산 적용하며 매년 6월 시점의 금액을 차트에 기록
  let runningYear = currentYear;
  let runningMonth = currentMonth;

  for (let m = 1; m <= remainingMonths; m++) {
    // 월말 이자 적립 및 납입금 추가
    currentFund = currentFund * (1 + monthlyRate) + monthlyContribution;
    
    // 매달 이력 중 소급 납입금이 일시 추가되는 가상 시나리오 적용
    if (m === 1 && simArrearPayment > 0) {
      currentFund += simArrearPayment;
    }

    runningMonth++;
    if (runningMonth > 12) {
      runningMonth = 1;
      runningYear++;
      chartLabels.push(`${runningYear}년`);
      chartDataPoints.push(Math.round(currentFund / 10000));
    }
  }

  // 루프 종료 후 최종 은퇴 시점 데이터 추가 (마지막 해가 정확히 추가되지 않았을 수 있으므로)
  const finalFund = currentFund;
  if (remainingMonths > 0 && runningMonth !== 1) {
    chartLabels.push(`은퇴 (${retirementYear}년 ${retirementMonth}월)`);
    chartDataPoints.push(Math.round(finalFund / 10000));
  }

  // --- 예상 수령액 계산 ---
  // 1. 모델 A: 기금 소진형 거치 연금 (연이율을 적용한 원리금 분할 상환 방식)
  const payoutYears = Math.max(5, simLifeExpectancy - simRetirementAge);
  const payoutMonths = payoutYears * 12;
  let modelAMonthlyPayout = 0;
  if (finalFund > 0 && payoutMonths > 0) {
    if (monthlyRate > 0) {
      modelAMonthlyPayout = (finalFund * (monthlyRate * Math.pow(1 + monthlyRate, payoutMonths))) / (Math.pow(1 + monthlyRate, payoutMonths) - 1);
    } else {
      modelAMonthlyPayout = finalFund / payoutMonths;
    }
  }

  // 2. 모델 B: 교단 지급율 연동 모델 (가입 개월 수 비례 기준봉급 적용)
  // 은퇴 시점의 가상 기준기본급 계산 (2026년 기준 145만원에서 매년 연상승률 적용)
  const yearsToRetire = Math.max(0, retirementYear - currentYear);
  const finalDefaultPay = 1450000 * Math.pow(1 + wageGrowthRate / 100, yearsToRetire);

  // 1994년 1월 이전 가입자 판별
  const ansuDateTrim = summary.AnsuDate?.trim() || '';
  const isBefore1994 = ansuDateTrim.length === 8 && ansuDateTrim.slice(0, 6) < '199401';

  // 기본 지급 비율 (일반납입비율합) 계산
  let generalPayoutRate = 0;
  if (isBefore1994) {
    // 1994년 이전 가입자: 240개월까지 월 0.25%, 초과분은 월 0.1667% (연 2.0%)
    const normalMonths = Math.min(240, totalProjectedMonths);
    const excessMonths = Math.max(0, totalProjectedMonths - 240);
    generalPayoutRate = (normalMonths * 0.0025) + (excessMonths * 0.001667);
  } else {
    // 1994년 이후 가입자: 월 0.25% (15년 180개월 완납 시 45% 기본 보장)
    generalPayoutRate = totalProjectedMonths * 0.0025;
  }

  // 지급결정율 = 일반납입비율합 + 특약비율 (기본 6.0%)
  const decisionRate = generalPayoutRate + 0.06;
  const decisionAmount = finalDefaultPay * decisionRate; // 지급결정액

  // 조기 은퇴 감액 적용비율 (정년 70세 기준 연 3% 감액)
  const agePenaltyRate = Math.max(0.1, 1.0 - Math.max(0, 70 - simRetirementAge) * 0.03);

  // 최종 적용비율 (수급 연차별)
  const ageAppliedRate1to10 = agePenaltyRate; // 1~10년차 적용비율
  const ageAppliedRate11to15 = Math.max(0, agePenaltyRate - 0.10); // 11~15년차 적용비율 (-10%p)
  const ageAppliedRate16plus = Math.max(0, agePenaltyRate - 0.15); // 16년차 이상 적용비율 (-15%p)

  // 월 지급액 연산 (천원 단위 절사 - 엑셀 ROUNDDOWN(..., -3) 정밀 정합)
  const monthlyPayout1to10 = Math.floor(decisionAmount * ageAppliedRate1to10 / 1000) * 1000;
  const monthlyPayout11to15 = Math.floor(decisionAmount * ageAppliedRate11to15 / 1000) * 1000;
  const monthlyPayout16plus = Math.floor(decisionAmount * ageAppliedRate16plus / 1000) * 1000;
  const monthlyPayoutSpouse = Math.floor((decisionAmount * ageAppliedRate16plus * 0.5) / 1000) * 1000; // 유족 연금 (50%)

  // 화면에 대표적으로 1~10년차 지급액 매핑
  const modelBMonthlyPayout = monthlyPayout1to10;

  // 차트 컴포넌트 데이터 구조 설정
  const data: ChartData<'line'> = {
    labels: chartLabels,
    datasets: [
      {
        label: '예측 누적 적립 기금 (만원)',
        data: chartDataPoints,
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderColor: 'hsl(222, 89%, 65%)',
        borderWidth: 2,
        pointBackgroundColor: 'hsl(222, 89%, 65%)',
        pointHoverRadius: 6,
        tension: 0.3,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const val = context.parsed.y;
            return `적립금: ${val !== null && val !== undefined ? val.toLocaleString() : 0} 만원`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.08)',
        },
        ticks: {
          color: '#cbd5e1', // Slate 300 (가독성 높은 연회색)
          font: { family: 'var(--font-family)', size: 11 }
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.08)',
        },
        ticks: {
          color: '#cbd5e1', // Slate 300
          font: { family: 'var(--font-family)', size: 11 },
          callback: function (value) {
            return `${Number(value).toLocaleString()}만`;
          },
        },
      },
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Upper Navigation & Name */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link href="/" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            ← 대시보드로 돌아가기
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <h1 style={{ fontSize: '2.25rem', background: 'linear-gradient(135deg, #fff 0%, var(--primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {summary.MemberName} 목사님 연금 분석
            </h1>
            <span className="badge badge-success" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
              연금번호 {summary.PenNo}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Overview Card */}
      <section className="glass-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>소속 노회 / 교회</div>
          <div style={{ fontSize: '1.15rem', fontWeight: '700', marginTop: '0.25rem' }}>
            {summary.NohName || '-'} 노회 / {summary.ChrName || '-'} 교회
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>생년월일 / 연락처</div>
          <div style={{ fontSize: '1.15rem', fontWeight: '700', marginTop: '0.25rem' }}>
            {birthYearStr ? `${birthYearStr}.${birthMonthStr}` : '-'} / {summary.Tel_Mobile || '-'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>현재 누적 적립액</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--success)', marginTop: '0.25rem' }}>
            {(summary.Amt || 0).toLocaleString()} 원
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>누적 납입 기간</div>
          <div style={{ fontSize: '1.15rem', fontWeight: '700', marginTop: '0.25rem' }}>
            {pastMonths} 개월 <span style={{ fontSize: '0.85rem', fontWeight: '400', color: 'var(--text-secondary)' }}>({(pastMonths / 12).toFixed(1)}년)</span>
          </div>
        </div>
      </section>

      {/* Main Grid: Control Panel (Left) & Results/Charts (Right) */}
      <div className="dashboard-grid">
        {/* Left: Interactive Control Sliders */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            시뮬레이션 조절 패널
          </h2>

          {/* 1. 은퇴 연령 */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="form-label">목표 은퇴 연령</span>
              <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{simRetirementAge} 세</span>
            </div>
            <input
              type="range"
              className="slider-input"
              min={60}
              max={75}
              value={simRetirementAge}
              onChange={(e) => setSimRetirementAge(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <span>60세</span>
              <span>65세</span>
              <span>70세</span>
              <span>75세</span>
            </div>
          </div>

          {/* 2. 미래 예상 이자율 */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="form-label">기금 미래 운용 연이율</span>
              <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{simInterestRate.toFixed(1)} %</span>
            </div>
            <input
              type="range"
              className="slider-input"
              min={0}
              max={6}
              step={0.1}
              value={simInterestRate}
              onChange={(e) => setSimInterestRate(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <span>0% (원금만)</span>
              <span>2.0%</span>
              <span>4.0%</span>
              <span>6.0%</span>
            </div>
          </div>

          {/* 3. 월 본인 납입액 */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="form-label">매월 추가 본인 납입금</span>
              <span style={{ fontWeight: '700' }}>{simMonthlyCont.toLocaleString()} 원</span>
            </div>
            <input
              type="range"
              className="slider-input"
              min={0}
              max={500000}
              step={10000}
              value={simMonthlyCont}
              onChange={(e) => setSimMonthlyCont(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <span>0원</span>
              <span>25만 원</span>
              <span>50만 원</span>
            </div>
          </div>

          {/* 4. 월 교회 매칭액 */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="form-label">매월 교회 매칭 지원금</span>
              <span style={{ fontWeight: '700' }}>{simMonthlyShare.toLocaleString()} 원</span>
            </div>
            <input
              type="range"
              className="slider-input"
              min={0}
              max={1000000}
              step={10000}
              value={simMonthlyShare}
              onChange={(e) => setSimMonthlyShare(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <span>0원</span>
              <span>50만 원</span>
              <span>100만 원</span>
            </div>
          </div>

          {/* 5. 소급 납입 일시금 */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="form-label">소급/미납 일시 납입금 (즉시 납입)</span>
              <span style={{ fontWeight: '700', color: 'var(--warning)' }}>{simArrearPayment.toLocaleString()} 원</span>
            </div>
            <input
              type="range"
              className="slider-input"
              min={0}
              max={50000000}
              step={1000000}
              value={simArrearPayment}
              onChange={(e) => setSimArrearPayment(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <span>0원</span>
              <span>2500만 원</span>
              <span>5000만 원</span>
            </div>
          </div>

          {/* 6. 수령 만료 연령 (모델 A용) */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="form-label">연금 수령 만료 목표연령 (기대수명)</span>
              <span style={{ fontWeight: '700' }}>만 {simLifeExpectancy} 세</span>
            </div>
            <input
              type="range"
              className="slider-input"
              min={75}
              max={100}
              value={simLifeExpectancy}
              onChange={(e) => setSimLifeExpectancy(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <span>75세</span>
              <span>85세</span>
              <span>100세</span>
            </div>
          </div>

          {/* 7. 연금 기준급 연상승률 (모델 B용) */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="form-label">총회 기준기본급 연 평균 인상률</span>
              <span style={{ fontWeight: '700' }}>{wageGrowthRate.toFixed(1)} %</span>
            </div>
            <input
              type="range"
              className="slider-input"
              min={0}
              max={5}
              step={0.1}
              value={wageGrowthRate}
              onChange={(e) => setWageGrowthRate(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              <span>0% (동결)</span>
              <span>2.5%</span>
              <span>5.0%</span>
            </div>
          </div>
        </section>

        {/* Right: Simulator Results & Chart Visualizations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Results Summary Box */}
          <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>예측 시뮬레이션 결과</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>은퇴 시점까지 남은 개월</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', marginTop: '0.2rem' }}>
                  {remainingMonths} 개월
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                  {(remainingMonths / 12).toFixed(1)}년 후 은퇴 ({retirementYear}년 {retirementMonth}월)
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>은퇴시 최종 예측 적립금</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)', marginTop: '0.2rem' }}>
                  {Math.round(finalFund).toLocaleString()} 원
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                  추가 납입 총액: {((simMonthlyCont + simMonthlyShare) * remainingMonths + simArrearPayment).toLocaleString()}원
                </div>
              </div>
            </div>

            {/* Payout Models */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              {/* Model A */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '0.975rem', color: 'var(--text-primary)' }}>수령 모델 A: 기금 소진형 거치 연금</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      은퇴 시점 최종 적립 기금에 연이율을 적용하여 만 {simLifeExpectancy}세까지 매달 균등 수령
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                      {Math.round(modelAMonthlyPayout).toLocaleString()} 원
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>월 수령액</span>
                  </div>
                </div>
              </div>

              {/* Model B */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '0.975rem', color: 'var(--text-primary)' }}>수령 모델 B: 교단 규정식 지급 연금</h3>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        최종 시무개월 수({totalProjectedMonths}개월, 즉 {(totalProjectedMonths/12).toFixed(1)}년) 및 1994년 가입기준 연동
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--success)' }}>
                        {monthlyPayout1to10.toLocaleString()} 원
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>기본 (1~10년차) 월 수령액</span>
                    </div>
                  </div>

                  {/* 연차별/유족 상세 내역 표 */}
                  <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.825rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span>수급 시기</span>
                      <span>적용비율 (정년대비)</span>
                      <span>월 수령액</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                      <span>1 ~ 10년차 수급</span>
                      <span>{(ageAppliedRate1to10 * 100).toFixed(1)}%</span>
                      <span style={{ fontWeight: '700' }}>{monthlyPayout1to10.toLocaleString()} 원</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                      <span>11 ~ 15년차 수급 (-10%p)</span>
                      <span>{(ageAppliedRate11to15 * 100).toFixed(1)}%</span>
                      <span style={{ fontWeight: '700', color: 'var(--warning)' }}>{monthlyPayout11to15.toLocaleString()} 원</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                      <span>16년차 이상 수급 (-15%p)</span>
                      <span>{(ageAppliedRate16plus * 100).toFixed(1)}%</span>
                      <span style={{ fontWeight: '700', color: 'var(--danger)' }}>{monthlyPayout16plus.toLocaleString()} 원</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderTop: '1px dotted var(--border-color)', marginTop: '0.25rem', paddingTop: '0.35rem' }}>
                      <span style={{ color: 'var(--success)', fontWeight: '600' }}>배우자 유족연금 (50%)</span>
                      <span>{((ageAppliedRate16plus * 0.5) * 100).toFixed(1)}%</span>
                      <span style={{ fontWeight: '700', color: 'var(--success)' }}>{monthlyPayoutSpouse.toLocaleString()} 원</span>
                    </div>
                  </div>

                  {/* 세부 지급 요율 산출 근거 */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                    <div>- 기준기본급: {Math.round(finalDefaultPay).toLocaleString()}원</div>
                    <div>- 일반납입비율: {(generalPayoutRate * 100).toFixed(2)}%</div>
                    <div>- 가입유형: {isBefore1994 ? '1994년 이전 가입 (20년 기준)' : '1994년 이후 가입 (15년 기준)'}</div>
                    <div>- 결정지급율: {(decisionRate * 100).toFixed(2)}% (특약 6% 포함)</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Chart Display Panel */}
          <section className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '320px' }}>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>연도별 누적 적립 기금 성장 예측 추이</h2>
            <div style={{ flex: 1, position: 'relative' }}>
              {mounted ? (
                <Line data={data} options={options} />
              ) : (
                <div style={{ textAlign: 'center', paddingTop: '4rem', color: 'var(--text-tertiary)' }}>차트 로딩 중...</div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Contribution History Table */}
      <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>납입 이력 내역</h2>
        <p className="sub-title">데이터베이스에 등록된 실제 연금 납입 내역 리스트입니다.</p>

        {history.length > 0 ? (
          <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>납입 년월</th>
                  <th>본인 납입액 (inContribute)</th>
                  <th>교회 매칭 지원금 (inShare)</th>
                  <th>소급금 (inArrear)</th>
                  <th>완납 여부</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.YYMM}>
                    <td style={{ fontWeight: '600' }}>
                      {record.YYMM.slice(0, 4)}년 {record.YYMM.slice(4, 6)}월
                    </td>
                    <td>{record.inContribute.toLocaleString()} 원</td>
                    <td>{record.inShare.toLocaleString()} 원</td>
                    <td>{record.inArrear.toLocaleString()} 원</td>
                    <td>
                      {record.Finish === 'Y' ? (
                        <span className="badge badge-success">완납</span>
                      ) : (
                        <span className="badge badge-warning">미완납</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', textAlign: 'center' }}>
            해당 연금 번호에 대한 상세 납입 이력이 없습니다.
          </p>
        )}
      </section>
    </div>
  );
}
