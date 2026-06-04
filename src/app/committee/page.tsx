'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions
} from 'chart.js';
import { Line, Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  ChartTitle,
  Tooltip,
  Legend,
  Filler
);

interface SimMember {
  PenNo: string | null;
  EndDate: string | null;
  BirthDay: string;
  PastMonths: number;
  CurrentAmt: number;
  LastContribute: number;
  LastShare: number;
  RealRetireAge?: number | null;
  IsRecipient?: number;
  LastPayType?: number | null;
  LastPayAmt?: number | null;
}



interface YearlyProjection {
  year: number;
  inflow: number;
  inflowNormal: number;
  inflowNew: number;
  inflowExtension: number;
  inflowInterest: number;
  outflow: number;
  endingAsset: number;
  activeMembers: number;
  payoutMembers: number;
  totalActiveMinisters: number;
  totalRetiredMinisters: number;
  actuarialLiability: number;
  fundingRatio: number;
  // 연령대별 활성 목회자 분포
  ageUnder40: number;
  age40s: number;
  age50s: number;
  age60s: number;
  age70plus: number;
  medianAge: number;
  averageAge: number;
}

export default function CommitteeDashboard() {
  const [mounted, setMounted] = useState(false);
  const [members, setMembers] = useState<SimMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 시뮬레이션 제어 변수 (제안 정책)
  const [simVoluntaryAge, setSimVoluntaryAge] = useState(68); // 제안 자원은퇴 나이
  const [simMandatoryAge, setSimMandatoryAge] = useState(73); // 제안 정년은퇴 나이
  const [voluntaryRatio, setVoluntaryRatio] = useState(20); // 자원은퇴 비율 %
  const [simNewSubscribers, setSimNewSubscribers] = useState(40); // 매년 신규 가입자 수 (엑셀 디폴트 40)
  const [interestRate, setInterestRate] = useState(4.0); // 연 기금 운용 수익률 % (엑셀 기준 4.0%)
  const [wageGrowth, setWageGrowth] = useState(1.5); // 연 평균 임금 상승률 %
  const [maleLife, setMaleLife] = useState(81); // 남성 평균 수명
  const [femaleLife, setFemaleLife] = useState(87); // 여성 평균 수명
  const [initialAsset, setInitialAsset] = useState(52419386890); // 2025년말 실제 연금자산 (대차대조표 기준 52,419,386,890원)


  // 6대 심화 고급 리스크 변수
  const [simNewSubDeclineRate, setSimNewSubDeclineRate] = useState(1.5); // 신규 가입자 감소율 %
  const [interestVolatility, setInterestVolatility] = useState(1.0); // 투자 수익률 변동성 %
  const [lifeExpectancyTrend, setLifeExpectancyTrend] = useState(0.15); // 고령화 기대수명 상승률 세/10년
  const [nonSelfSufficientRatio, setNonSelfSufficientRatio] = useState(30); // 미자립 교회 비율 %
  const [simCpiIndexing, setSimCpiIndexing] = useState(false); // 물가 연동 지급액 인상 적용 여부
  const [simCpiRate, setSimCpiRate] = useState(1.5); // 연평균 물가상승률(CPI) %
  const [simLumpSumRatio, setSimLumpSumRatio] = useState(5); // 일시금 수령 퇴출 비율 %

  // 추가 정책 변수
  const [simDiscountRate, setSimDiscountRate] = useState(3.5); // 할인율 %
  const [simContributionRate, setSimContributionRate] = useState(9.0); // 기여율(보험료율) %
  const [simSubsidyRate, setSimSubsidyRate] = useState(0.0); // 미자립교회 재정보조율 %

  // 듀얼 스크린 동기화 모드 상태 ('normal': 기본, 'control': 제어창만, 'viewer': 차트 대시보드, 'chart-*': 개별 차트 단독)
  const [mode, setMode] = useState<'normal' | 'control' | 'viewer' | 'chart-asset' | 'chart-ministers' | 'chart-population' | 'chart-agepyramid' | 'chart-shortterm'>('normal');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const bc = useRef<BroadcastChannel | null>(null);

  // 차트 범례 클릭 시 하이라이트 상태 변수
  const [highlightedAssetIndices, setHighlightedAssetIndices] = useState<number[]>([]);
  const [highlightedMinistersIndices, setHighlightedMinistersIndices] = useState<number[]>([]);
  const [highlightedShortTermIndices, setHighlightedShortTermIndices] = useState<number[]>([]);
  const [highlightedTotalMinistersIndices, setHighlightedTotalMinistersIndices] = useState<number[]>([]);
  const [highlightedAgePyramidIndices, setHighlightedAgePyramidIndices] = useState<number[]>([]);

  // 고정값 (기존 정책 비교용)
  const BASE_VOLUNTARY_AGE = 65;
  const BASE_MANDATORY_AGE = 70;

  const assetChartRef = useRef<ChartJS<'line'>>(null);
  const ministersChartRef = useRef<ChartJS<'line'>>(null);
  const shortTermChartRef = useRef<ChartJS<'bar' | 'line'>>(null);
  const totalMinistersChartRef = useRef<ChartJS<'line'>>(null);
  const agePyramidChartRef = useRef<ChartJS<'line'>>(null);

  interface ZoomableChart {
    resetZoom: () => void;
  }

  const handleResetAssetZoom = () => {
    if (assetChartRef.current) {
      const chart = assetChartRef.current as unknown as ZoomableChart;
      chart.resetZoom();
    }
  };

  const handleResetMinistersZoom = () => {
    if (ministersChartRef.current) {
      const chart = ministersChartRef.current as unknown as ZoomableChart;
      chart.resetZoom();
    }
  };

  const handleResetShortTermZoom = () => {
    if (shortTermChartRef.current) {
      const chart = shortTermChartRef.current as unknown as ZoomableChart;
      chart.resetZoom();
    }
  };

  const handleResetTotalMinistersZoom = () => {
    if (totalMinistersChartRef.current) {
      const chart = totalMinistersChartRef.current as unknown as ZoomableChart;
      chart.resetZoom();
    }
  };

  const handleResetAgePyramidZoom = () => {
    if (agePyramidChartRef.current) {
      const chart = agePyramidChartRef.current as unknown as ZoomableChart;
      chart.resetZoom();
    }
  };

  useEffect(() => {
    // chartjs-plugin-zoom을 dynamic import하여 클라이언트 측에서만 등록
    Promise.all([
      import('chartjs-plugin-zoom'),
      fetch('/api/pension/sim-data').then((res) => res.json())
    ])
      .then(([zoomModule, res]) => {
        ChartJS.register(zoomModule.default);
        setMounted(true);
        if (res.success) {
          setMembers(res.data);
        } else {
          setError(res.error || '시뮬레이션 데이터를 가져오지 못했습니다.');
        }
      })
      .catch((err) => {
        console.error(err);
        setError('서버 연결 및 필수 모듈 로드 중 오류가 발생했습니다.');
      })
      .finally(() => setLoading(false));
  }, []);

  // 듀얼 스크린 동기화 메시지 이벤트 구독
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    const chartViewerModes = ['viewer', 'chart-asset', 'chart-ministers', 'chart-population', 'chart-agepyramid', 'chart-shortterm'];

    if (m === 'control') {
      setMode('control');
    } else if (m && chartViewerModes.includes(m)) {
      setMode(m as any);
    } else {
      setMode('normal');
    }

    const channel = new BroadcastChannel('pension-simulator-channel');
    bc.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'sync-parameters') {
        setSimVoluntaryAge(payload.simVoluntaryAge);
        setSimMandatoryAge(payload.simMandatoryAge);
        setVoluntaryRatio(payload.voluntaryRatio);
        setSimNewSubscribers(payload.simNewSubscribers);
        setInterestRate(payload.interestRate);
        setWageGrowth(payload.wageGrowth);
        setMaleLife(payload.maleLife);
        setFemaleLife(payload.femaleLife);
        setInitialAsset(payload.initialAsset);
        setSimNewSubDeclineRate(payload.simNewSubDeclineRate);
        setInterestVolatility(payload.interestVolatility);
        setLifeExpectancyTrend(payload.lifeExpectancyTrend);
        setNonSelfSufficientRatio(payload.nonSelfSufficientRatio);
        setSimCpiIndexing(payload.simCpiIndexing);
        setSimCpiRate(payload.simCpiRate);
        setSimLumpSumRatio(payload.simLumpSumRatio);
        setSimDiscountRate(payload.simDiscountRate);
        setSimContributionRate(payload.simContributionRate);
        setSimSubsidyRate(payload.simSubsidyRate);
      } else if (type === 'request-init' && (!m || !chartViewerModes.includes(m))) {
        channel.postMessage({
          type: 'response-init',
          payload: {
            simVoluntaryAge,
            simMandatoryAge,
            voluntaryRatio,
            simNewSubscribers,
            interestRate,
            wageGrowth,
            maleLife,
            femaleLife,
            initialAsset,
            simNewSubDeclineRate,
            interestVolatility,
            lifeExpectancyTrend,
            nonSelfSufficientRatio,
            simCpiIndexing,
            simCpiRate,
            simLumpSumRatio,
            simDiscountRate,
            simContributionRate,
            simSubsidyRate
          }
        });
      } else if (type === 'response-init' && m && chartViewerModes.includes(m)) {
        setSimVoluntaryAge(payload.simVoluntaryAge);
        setSimMandatoryAge(payload.simMandatoryAge);
        setVoluntaryRatio(payload.voluntaryRatio);
        setSimNewSubscribers(payload.simNewSubscribers);
        setInterestRate(payload.interestRate);
        setWageGrowth(payload.wageGrowth);
        setMaleLife(payload.maleLife);
        setFemaleLife(payload.femaleLife);
        setInitialAsset(payload.initialAsset);
        setSimNewSubDeclineRate(payload.simNewSubDeclineRate);
        setInterestVolatility(payload.interestVolatility);
        setLifeExpectancyTrend(payload.lifeExpectancyTrend);
        setNonSelfSufficientRatio(payload.nonSelfSufficientRatio);
        setSimCpiIndexing(payload.simCpiIndexing);
        setSimCpiRate(payload.simCpiRate);
        setSimLumpSumRatio(payload.simLumpSumRatio);
        setSimDiscountRate(payload.simDiscountRate);
        setSimContributionRate(payload.simContributionRate);
        setSimSubsidyRate(payload.simSubsidyRate);
      } else if (type === 'close-control-panel' && (m === 'control' || chartViewerModes.includes(m || ''))) {
        if (typeof window !== 'undefined' && window.opener) {
          window.close();
        }
      } else if (type === 'restore-normal' && m && chartViewerModes.includes(m)) {
        setMode('normal');
        window.history.replaceState(null, '', '/committee');
      }
    };

    if (m && chartViewerModes.includes(m)) {
      channel.postMessage({ type: 'request-init' });
    }

    return () => {
      channel.close();
    };
  }, [
    mounted,
    simVoluntaryAge,
    simMandatoryAge,
    voluntaryRatio,
    simNewSubscribers,
    interestRate,
    wageGrowth,
    maleLife,
    femaleLife,
    initialAsset,
    simNewSubDeclineRate,
    interestVolatility,
    lifeExpectancyTrend,
    nonSelfSufficientRatio,
    simCpiIndexing,
    simCpiRate,
    simLumpSumRatio,
    simDiscountRate,
    simContributionRate,
    simSubsidyRate
  ]);

  // 설정 제어 모드일 때 매개변수 실시간 송출
  useEffect(() => {
    if (!bc.current || ['viewer', 'chart-asset', 'chart-ministers', 'chart-population', 'chart-agepyramid', 'chart-shortterm'].includes(mode)) return;
    bc.current.postMessage({
      type: 'sync-parameters',
      payload: {
        simVoluntaryAge,
        simMandatoryAge,
        voluntaryRatio,
        simNewSubscribers,
        interestRate,
        wageGrowth,
        maleLife,
        femaleLife,
        initialAsset,
        simNewSubDeclineRate,
        interestVolatility,
        lifeExpectancyTrend,
        nonSelfSufficientRatio,
        simCpiIndexing,
        simCpiRate,
        simLumpSumRatio,
        simDiscountRate,
        simContributionRate,
        simSubsidyRate
      }
    });
  }, [
    mode,
    simVoluntaryAge,
    simMandatoryAge,
    voluntaryRatio,
    simNewSubscribers,
    interestRate,
    wageGrowth,
    maleLife,
    femaleLife,
    initialAsset,
    simNewSubDeclineRate,
    interestVolatility,
    lifeExpectancyTrend,
    nonSelfSufficientRatio,
    simCpiIndexing,
    simCpiRate,
    simLumpSumRatio,
    simDiscountRate,
    simContributionRate,
    simSubsidyRate
  ]);

  const handleOpenDualMode = () => {
    const controlWindow = window.open(
      '/committee?mode=control',
      'PensionControlPanel',
      'width=480,height=900,scrollbars=yes,resizable=yes'
    );
    if (controlWindow) {
      const chartViewerModes = ['viewer', 'chart-asset', 'chart-ministers', 'chart-population', 'chart-agepyramid', 'chart-shortterm'];
      if (!chartViewerModes.includes(mode)) {
        setMode('viewer');
        window.history.replaceState(null, '', '/committee?mode=viewer');
      }
    } else {
      alert('설정 제어 팝업창을 띄우지 못했습니다. 팝업 차단 설정을 해제해 주세요.');
    }
  };

  const handleRestoreNormalMode = () => {
    setMode('normal');
    window.history.replaceState(null, '', '/committee');
    if (bc.current) {
      bc.current.postMessage({ type: 'close-control-panel' });
    }
  };

  // ESC 키 클릭 시 차트 하이라이트 상태 초기화
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHighlightedAssetIndices([]);
        setHighlightedMinistersIndices([]);
        setHighlightedShortTermIndices([]);
        setHighlightedTotalMinistersIndices([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 연도별 프로젝션 시뮬레이션 연산 (엑셀 감액 및 완납율 공식 연계)
  const runSimulation = (
    voluntaryAge: number,
    mandatoryAge: number,
    rate: number,
    growth: number,
    maleExp: number,
    femaleExp: number,
    startAsset: number,
    newSubsPerYear: number,
    contributionRate: number,
    discountRate: number,
    subsidyRate: number,
    voluntaryRatioVal: number,
    isProposed?: boolean
  ) => {
    const projectionYears = 40; // 40년 예측 (2026 ~ 2065)
    const results: YearlyProjection[] = [];
    let currentAsset = startAsset;

    // 2025년 실제 대차대조표 및 DB 캐시플로우 실적 주입
    results.push({
      year: 2025,
      inflow: 6231441200,
      inflowNormal: 6231441200,
      inflowNew: 0,
      inflowExtension: 0,
      inflowInterest: 1449924820,
      outflow: 6411500000,
      endingAsset: 52419386890,
      activeMembers: 2119,
      payoutMembers: 701,
      totalActiveMinisters: 3733,
      totalRetiredMinisters: 701,
      actuarialLiability: 0, // 루프가 끝난 뒤 보정
      fundingRatio: 0,       // 루프가 끝난 뒤 보정
      ageUnder40: 0,
      age40s: 0,
      age50s: 0,
      age60s: 0,
      age70plus: 0,
      medianAge: 0,
      averageAge: 0
    });


    // 미자립 교회 비율 연동 완납율 계산 (제안안의 경우 보조율에 따라 미자립교회 완납율 선형 상승 보정)
    const selfSufficientCompliance = 0.90;
    const nonSelfSufficientBaseCompliance = 0.67;
    const nonSelfSufficientCompliance = nonSelfSufficientBaseCompliance + (selfSufficientCompliance - nonSelfSufficientBaseCompliance) * (subsidyRate / 100);
    const blendedComplianceRate = (selfSufficientCompliance * (1 - nonSelfSufficientRatio / 100) + nonSelfSufficientCompliance * (nonSelfSufficientRatio / 100));

    // 동적 가입자 배열 초기화 (기존 가입자 복제 및 미가입자 포함)
    interface VirtualMember {
      birthYear: number;
      pastMonths: number;
      lastContribute: number;
      lastShare: number;
      endDate: string | null;
      joinYear: number;
      isNew: boolean;
      active: boolean; // 활성 가입 여부 (자연감소율 적용)
      isEnrolled: boolean;
      realRetireAge?: number | null;
      isRecipient?: number;
      lastPayType?: number | null;
      lastPayAmt?: number | null;
    }

    let virtualMembers: VirtualMember[] = members.map((m, idx) => {
      const birthDayTrim = m.BirthDay?.trim() || '';
      let birthYear = 1965;
      if (birthDayTrim.length === 8) {
        const parsed = parseInt(birthDayTrim.slice(0, 4));
        if (!isNaN(parsed) && parsed > 1900 && parsed < 2026) {
          birthYear = parsed;
        }
      } else {
        // 생년월일 미기재 회원이 특정 단일 연도(1965년)에 몰려 집단 은퇴/사망하는 통계적 왜곡(2046년 부근 급격한 절벽)을 방지하기 위해 1955~1985년 사이로 균등 분산 할당
        birthYear = 1955 + (idx % 31);
      }
      
      const isEnrolled = m.PenNo !== null && m.PenNo.trim() !== '' && (m.CurrentAmt > 0 || m.PastMonths > 0);

      return {
        birthYear,
        pastMonths: isEnrolled ? m.PastMonths : 0,
        lastContribute: isEnrolled ? ((m.LastContribute && m.LastContribute > 0) ? m.LastContribute : 142000) : 0,
        lastShare: isEnrolled ? ((m.LastShare && m.LastShare > 0) ? m.LastShare : 228000) : 0,
        endDate: m.EndDate,
        joinYear: isEnrolled ? 2025 : 9999, // 미가입자는 일단 시뮬레이션 외각
        isNew: false,
        active: isEnrolled || m.IsRecipient === 1, // 가입자 또는 이미 수급 중인 사람 최초 활성화
        isEnrolled,
        realRetireAge: m.RealRetireAge,
        isRecipient: m.IsRecipient,
        lastPayType: m.LastPayType,
        lastPayAmt: m.LastPayAmt
      };
    });

    // 2026년부터 2065년까지 루프
    for (let i = 0; i < projectionYears; i++) {
      const year = 2026 + i;
      let yearlyInflow = 0;
      let yearlyInflowNormal = 0;
      let yearlyInflowNew = 0;
      let yearlyInflowExtension = 0;
      let yearlyOutflow = 0;
      let activeCount = 0;
      let payoutCount = 0;
      let activeMinistersCount = 0;
      let retiredMinistersCount = 0;
      const activeAges: number[] = []; // 활성 목회자 나이 수집

      // 1. 가입자 자연감소율 (2.0%) 적용 (매년 기존 활성 가입자의 2%가 자연 퇴출/사망 가정)
      virtualMembers.forEach((m) => {
        if (m.active && m.joinYear < year) {
          if (Math.random() < 0.02) {
            m.active = false;
          }
        }
      });

      // 2. 신규 가입자 유치 (매년 newSubsPerYear 명씩 유입)
      if (i > 0 && newSubsPerYear > 0) {
        let introduced = 0;
        const declineRate = simNewSubDeclineRate;
        const currentYearNewSubs = Math.round(newSubsPerYear * Math.pow(1 - declineRate / 100, i));
        
        if (currentYearNewSubs > 0) {
          // 2.1 실제 미가입 목회자 풀 중 현재 55세 이하(70세 은퇴 기준 15년 이상 납입 가능 연령)인 자를 먼저 가입시킴
          for (let idx = 0; idx < virtualMembers.length; idx++) {
            const vm = virtualMembers[idx];
            if (!vm.isEnrolled && vm.birthYear !== null) {
              const ageThisYear = year - vm.birthYear;
              if (ageThisYear <= 55) {
                vm.isEnrolled = true;
                vm.active = true;
                vm.joinYear = year;
                vm.lastContribute = 142000;
                vm.lastShare = 228000;
                vm.pastMonths = 0;
                introduced++;
                if (introduced >= currentYearNewSubs) break;
              }
            }
          }

          // 2.2 미가입자 풀에서 다 못 채웠다면, 만 30세 신규 목회자를 새롭게 생성하여 가입시킴
          if (introduced < currentYearNewSubs) {
            const remainingSlots = currentYearNewSubs - introduced;
            for (let k = 0; k < remainingSlots; k++) {
              virtualMembers.push({
                birthYear: year - 30, // 가입 당시 만 30세
                pastMonths: 0,
                lastContribute: 142000,
                lastShare: 242000,
                endDate: null,
                joinYear: year,
                isNew: true,
                active: true,
                isEnrolled: true,
                realRetireAge: null
              });
            }
          }
        }
      }

      // 3. 개별 가입자별 수지 연산
      virtualMembers.forEach((member, idx) => {
        // 이미 은퇴한 사람은 DB의 실제 은퇴 나이가 있으면 그것을 고정 사용, 없으면 시뮬레이션 분산 설정값 적용
        let retireAge = member.endDate && member.realRetireAge ? member.realRetireAge : 70;

        if (!(member.endDate && member.realRetireAge)) {
          // 아직 은퇴하지 않은 가입자의 미래 은퇴 연령 결정 (사용자가 설정한 자원 은퇴자 선택 비율 반영)
          const bucket = idx % 1000;
          const totalVolAndMan = 791;
          const targetVoluntaryCount = Math.round(totalVolAndMan * (voluntaryRatioVal / 100));
          const targetVolStartCount = Math.round(targetVoluntaryCount * (111 / 434));

          const limit1 = targetVolStartCount;
          const limit2 = targetVoluntaryCount;
          const limit3 = totalVolAndMan;
          const limit4 = totalVolAndMan + 178;

          if (bucket < limit1) {
            // 1. 만 65세 은퇴 (자원은퇴 초입) -> 제안안 비율에 맞춰 voluntaryAge 적용
            retireAge = voluntaryAge;
          } else if (bucket < limit2) {
            // 2. 만 66세 ~ 69세 은퇴 (자원은퇴) -> voluntaryAge + 1 ~ mandatoryAge - 1 사이 균등 배분
            const range = Math.max(1, mandatoryAge - voluntaryAge - 1);
            retireAge = voluntaryAge + 1 + (bucket % range);
          } else if (bucket < limit3) {
            // 3. 만 70세 ~ 71세 은퇴 (정년은퇴 및 유예) -> mandatoryAge ~ mandatoryAge + 1 균등 배분
            retireAge = mandatoryAge + (bucket % 2);
          } else if (bucket < limit4) {
            // 4. 기타 조기 은퇴 (50세 ~ 64세) -> 50세 ~ voluntaryAge - 1 사이 균등 배분
            const range = Math.max(1, voluntaryAge - 50);
            retireAge = 50 + (bucket % range);
          } else {
            // 5. 기타 만기 은퇴 (72세 ~ 78세) -> mandatoryAge + 2 ~ mandatoryAge + 8 사이 균등 배분
            const range = Math.max(1, 78 - (mandatoryAge + 2) + 1);
            retireAge = mandatoryAge + 2 + (bucket % range);
          }
        }

        const retireYear = member.birthYear + retireAge;
        const additionalLife = (year - 2026) / 10 * lifeExpectancyTrend;
        
        let calculatedMaleDeathYear = member.birthYear + maleExp + additionalLife;
        let calculatedFemaleDeathYear = member.birthYear + femaleExp + additionalLife;

        // [보정] 기존 실제 수급자(IsRecipient === 1)의 경우, 이미 2026년에 생존해 있으므로 나이 대비 기대여명을 보장
        if (member.isRecipient === 1) {
          const currentAge = 2026 - member.birthYear;
          if (currentAge >= maleExp) {
            let remainingLife = 3;
            if (currentAge < 85) remainingLife = 6;
            else if (currentAge < 90) remainingLife = 4;
            calculatedMaleDeathYear = 2026 + remainingLife;
          }
          if (currentAge >= femaleExp) {
            let remainingLife = 3;
            if (currentAge < 92) remainingLife = 5;
            calculatedFemaleDeathYear = 2026 + remainingLife;
          }
          // 2026년 당해 연도에는 사망하여 탈락하지 않도록 보장
          calculatedMaleDeathYear = Math.max(calculatedMaleDeathYear, 2026.5);
          calculatedFemaleDeathYear = Math.max(calculatedFemaleDeathYear, 2026.5);
        }

        const maleDeathYear = calculatedMaleDeathYear;
        const femaleDeathYear = calculatedFemaleDeathYear;

        // 연금 가입 여부와 관계없이 생사 및 은퇴 여부 판별하여 총원 집계
        if (year < maleDeathYear) {
          if (year < retireYear) {
            activeMinistersCount++;
            activeAges.push(year - member.birthYear);
          } else {
            retiredMinistersCount++;
          }
        }

        if (!member.active) return; // 비활성화(미가입 또는 자연감소)된 가입자는 제외

        const isVoluntary = retireAge < mandatoryAge;
        const baseRetireAge = isVoluntary ? BASE_VOLUNTARY_AGE : BASE_MANDATORY_AGE; // 기존 정책 정년 기준점

        // 이미 은퇴하여 연금을 수급 중인 수급자 판별 (IsRecipient === 1)
        const isAlreadyRetired = member.isRecipient === 1;

        if (isAlreadyRetired) {
          // 이미 은퇴 상태: 납입(Inflow)은 없고 지출만 발생
          if (year >= 2026 && year < femaleDeathYear) {
            payoutCount++;
            
            // 가상의 145만 원 대신 실제 최근 수령액 적용
            const basePay = member.lastPayAmt || 0;
            const payoutFactor = year >= maleDeathYear ? 0.5 : 1.0; // 사망 시 유족연금 50% 감액 전환
            
            // 물가 연동(CPI) 지급액 인상 적용
            const cpiFactor = simCpiIndexing ? Math.pow(1 + simCpiRate / 100, year - Math.min(2026, retireYear)) : 1.0;

            const monthlyPayout = Math.floor((basePay * payoutFactor * cpiFactor) / 1000) * 1000;
            yearlyOutflow += monthlyPayout * 12;
          }
        } else {
          // 납입 중인 활성 가입자 (신규 가입자 포함)
          if (year >= member.joinYear) {
            if (year < retireYear && year >= 2026) {
              // 3.1 납입기 (Inflow)
              activeCount++;
              const yearsFactor = year - 2026;
              const inflatedMonthlyPay = (member.lastContribute + member.lastShare) * Math.pow(1 + growth / 100, yearsFactor);
              
              // 이 멤버가 미자립교회 소속인지 판별 (nonSelfSufficientRatio 비율 적용)
              const isNonSelfSufficient = (idx % 100) < nonSelfSufficientRatio;
              const memberCompliance = isNonSelfSufficient ? nonSelfSufficientCompliance : selfSufficientCompliance;
              
              // 기여율(보험료율) 9% 기준 배율 반영
              const rateMultiplier = contributionRate / 9.0;
              
              const monthlyInflowValue = inflatedMonthlyPay * rateMultiplier * memberCompliance * 12;
              yearlyInflow += monthlyInflowValue;

              // 총회 보조금 지출 계산 (미자립교회이고 보조율이 있는 경우)
              if (isNonSelfSufficient && subsidyRate > 0) {
                // 총회가 미자립교회 매칭 분담금(lastShare)의 일부(subsidyRate %)를 대납해 줌
                const monthlyShare = member.lastShare * Math.pow(1 + growth / 100, yearsFactor);
                const yearlySubsidy = monthlyShare * 12 * (subsidyRate / 100) * memberCompliance;
                yearlyOutflow += yearlySubsidy;
              }

              if (member.isNew) {
                yearlyInflowNew += monthlyInflowValue;
              } else if (year >= member.birthYear + baseRetireAge) {
                yearlyInflowExtension += monthlyInflowValue;
              } else {
                yearlyInflowNormal += monthlyInflowValue;
              }
            } 
            else if (year >= retireYear && year < femaleDeathYear) {
              // 3.2 수령기 (Outflow)
              const totalMonths = member.pastMonths + Math.max(0, (retireYear - member.joinYear) * 12);
              
              // 15년(180개월) 이상 납입한 경우에만 연금 지급
              if (totalMonths >= 180) {
                // 일시금(Lump-sum) 수령 비율 적용 판별
                const isLumpSum = (idx % 100) < simLumpSumRatio;

                if (isLumpSum) {
                  // 은퇴 첫 해에 일시금 수령 (평균 8천만 원 기준 임금상승률 반영)
                  if (year === retireYear) {
                    const lumpSumAmount = 80000000 * Math.pow(1 + growth / 100, Math.max(0, retireYear - 2026));
                    yearlyOutflow += lumpSumAmount;
                  }
                  // 일시금 수령자는 매월 받는 정기 수급자 수(payoutCount)에 포함되지 않고 정기 지출도 발생 안 함
                } else {
                  payoutCount++;
                  // 일반 납입 비율 계산
                  let generalPayoutRate = 0;
                  if (member.isNew) {
                    generalPayoutRate = totalMonths * 0.0025;
                  } else {
                    const normalMonths = Math.min(240, totalMonths);
                    const excessMonths = Math.max(0, totalMonths - 240);
                    generalPayoutRate = (normalMonths * 0.0025) + (excessMonths * 0.001667);
                  }

                  // 지급결정율 = 일반비율합 + 특약 6%
                  const decisionRate = generalPayoutRate + 0.06;
                  const retireInflatedDefaultPay = 1450000 * Math.pow(1 + growth / 100, Math.max(0, retireYear - 2026));
                  
                  // 물가 연동(CPI) 지급액 인상 적용
                  const cpiFactor = simCpiIndexing ? Math.pow(1 + simCpiRate / 100, year - retireYear) : 1.0;
                  const decisionAmount = retireInflatedDefaultPay * decisionRate * cpiFactor;

                  // 조기 은퇴 감액률 적용 (사용자가 지정한 정년 은퇴 나이를 기준으로 역산)
                  const basePenaltyRate = Math.max(0.1, 1.0 - Math.max(0, mandatoryAge - retireAge) * 0.03);

                  // 수급 년차별 2차 슬라이딩 감액율
                  const yearsSinceRetire = year - retireYear;
                  let finalPenaltyRate = basePenaltyRate;
                  if (yearsSinceRetire >= 15) {
                    finalPenaltyRate = Math.max(0, basePenaltyRate - 0.15); // 16년차 이상 (-15%p)
                  } else if (yearsSinceRetire >= 10) {
                    finalPenaltyRate = Math.max(0, basePenaltyRate - 0.10); // 11~15년차 (-10%p)
                  }

                  const payoutFactor = year >= maleDeathYear ? 0.5 : 1.0; // 유족 연금 50%
                  const monthlyPayout = Math.floor((decisionAmount * finalPenaltyRate * payoutFactor) / 1000) * 1000;
                  yearlyOutflow += monthlyPayout * 12;
                }
              }
            }
          }
        }
      });

      // 4. 계리 부채 (Actuarial Liability) 계산
      let actuarialLiability = 0;
      const d = discountRate / 100;

      virtualMembers.forEach((member, memberIdx) => {
        if (!member.active) return;

        let retireAge = member.endDate && member.realRetireAge ? member.realRetireAge : 70;
        if (!(member.endDate && member.realRetireAge)) {
          // 아직 은퇴하지 않은 가입자의 미래 은퇴 연령 결정 (사용자가 설정한 자원 은퇴자 선택 비율 반영)
          const bucket = memberIdx % 1000;
          const totalVolAndMan = 791;
          const targetVoluntaryCount = Math.round(totalVolAndMan * (voluntaryRatioVal / 100));
          const targetVolStartCount = Math.round(targetVoluntaryCount * (111 / 434));

          const limit1 = targetVolStartCount;
          const limit2 = targetVoluntaryCount;
          const limit3 = totalVolAndMan;
          const limit4 = totalVolAndMan + 178;

          if (bucket < limit1) {
            retireAge = voluntaryAge;
          } else if (bucket < limit2) {
            const range = Math.max(1, mandatoryAge - voluntaryAge - 1);
            retireAge = voluntaryAge + 1 + (bucket % range);
          } else if (bucket < limit3) {
            retireAge = mandatoryAge + (bucket % 2);
          } else if (bucket < limit4) {
            const range = Math.max(1, voluntaryAge - 50);
            retireAge = 50 + (bucket % range);
          } else {
            const range = Math.max(1, 78 - (mandatoryAge + 2) + 1);
            retireAge = mandatoryAge + 2 + (bucket % range);
          }
        }

        const retireYear = member.birthYear + retireAge;
        const additionalLife = (year - 2026) / 10 * lifeExpectancyTrend;
        
        let calculatedMaleDeathYear = member.birthYear + maleExp + additionalLife;
        let calculatedFemaleDeathYear = member.birthYear + femaleExp + additionalLife;

        // [보정] 기존 실제 수급자(IsRecipient === 1)의 경우 최소 기대여명을 보장
        if (member.isRecipient === 1) {
          const currentAge = 2026 - member.birthYear;
          if (currentAge >= maleExp) {
            let remainingLife = 3;
            if (currentAge < 85) remainingLife = 6;
            else if (currentAge < 90) remainingLife = 4;
            calculatedMaleDeathYear = 2026 + remainingLife;
          }
          if (currentAge >= femaleExp) {
            let remainingLife = 3;
            if (currentAge < 92) remainingLife = 5;
            calculatedFemaleDeathYear = 2026 + remainingLife;
          }
          calculatedMaleDeathYear = Math.max(calculatedMaleDeathYear, 2026.5);
          calculatedFemaleDeathYear = Math.max(calculatedFemaleDeathYear, 2026.5);
        }

        const maleDeathYear = calculatedMaleDeathYear;
        const femaleDeathYear = calculatedFemaleDeathYear;

        const isAlreadyRetired = member.isRecipient === 1;
        const totalMonths = member.pastMonths + Math.max(0, (retireYear - member.joinYear) * 12);
        if (!isAlreadyRetired && totalMonths < 180) return; // 15년 미납자는 권리 없음 (기존 수급자는 예외)

        const isLumpSum = (memberIdx % 100) < simLumpSumRatio;

        if (isLumpSum && !isAlreadyRetired) {
          // 일시금 부채 평가
          if (retireYear >= year) {
            const t = retireYear - year;
            const lumpSumAmount = 80000000 * Math.pow(1 + growth / 100, Math.max(0, retireYear - 2026));
            actuarialLiability += lumpSumAmount / Math.pow(1 + d, t);
          }
        } else {
          // 정기 연금 부채 평가
          const startPayYear = Math.max(year, retireYear);
          const endPayYear = Math.ceil(femaleDeathYear);
          if (startPayYear >= endPayYear) return;

          if (isAlreadyRetired) {
            // 기존 수급자 부채 평가
            const basePay = member.lastPayAmt || 0;
            for (let py = startPayYear; py < endPayYear; py++) {
              const t = py - year;
              const payoutFactor = py >= maleDeathYear ? 0.5 : 1.0;
              const cpiFactor = simCpiIndexing ? Math.pow(1 + simCpiRate / 100, py - Math.min(2026, retireYear)) : 1.0;
              const yearlyPayout = basePay * payoutFactor * cpiFactor * 12;
              actuarialLiability += yearlyPayout / Math.pow(1 + d, t);
            }
          } else {
            // 미래 수급자 부채 평가
            const retireInflatedDefaultPay = 1450000 * Math.pow(1 + growth / 100, Math.max(0, retireYear - 2026));
            
            let generalPayoutRate = 0;
            if (member.isNew) {
              generalPayoutRate = totalMonths * 0.0025;
            } else {
              const normalMonths = Math.min(240, totalMonths);
              const excessMonths = Math.max(0, totalMonths - 240);
              generalPayoutRate = (normalMonths * 0.0025) + (excessMonths * 0.001667);
            }
            const decisionRate = generalPayoutRate + 0.06;
            const decisionAmount = retireInflatedDefaultPay * decisionRate;
            const basePenaltyRate = Math.max(0.1, 1.0 - Math.max(0, mandatoryAge - retireAge) * 0.03);

            for (let py = startPayYear; py < endPayYear; py++) {
              const t = py - year;
              const yearsSinceRetire = py - retireYear;
              
              let finalPenaltyRate = basePenaltyRate;
              if (yearsSinceRetire >= 15) {
                finalPenaltyRate = Math.max(0, basePenaltyRate - 0.15);
              } else if (yearsSinceRetire >= 10) {
                finalPenaltyRate = Math.max(0, basePenaltyRate - 0.10);
              }

              const payoutFactor = py >= maleDeathYear ? 0.5 : 1.0;
              const cpiFactor = simCpiIndexing ? Math.pow(1 + simCpiRate / 100, py - retireYear) : 1.0;
              const yearlyPayout = decisionAmount * finalPenaltyRate * payoutFactor * cpiFactor * 12;

              actuarialLiability += yearlyPayout / Math.pow(1 + d, t);
            }
          }
        }
      });

      // 연도말 자산 정산: results[0] 에 2025년 실적이 있으므로, 2026년(i=0)일 때 prevAsset 은 2025년 말 자산(results[0].endingAsset)이 됨
      const prevAsset = results[i].endingAsset;
      const yearlyInflowInterest = Math.max(0, Math.round(prevAsset * (rate / 100)));
      
      currentAsset = prevAsset + yearlyInflow + yearlyInflowInterest - yearlyOutflow;
      const fundingRatio = actuarialLiability > 0 ? (currentAsset / actuarialLiability) * 100 : 100;

      // 연령대별 분류
      const ageUnder40 = activeAges.filter(a => a < 40).length;
      const age40s = activeAges.filter(a => a >= 40 && a < 50).length;
      const age50s = activeAges.filter(a => a >= 50 && a < 60).length;
      const age60s = activeAges.filter(a => a >= 60 && a < 70).length;
      const age70plus = activeAges.filter(a => a >= 70).length;
      const sortedAges = [...activeAges].sort((a, b) => a - b);
      const medianAge = sortedAges.length > 0 ? sortedAges[Math.floor(sortedAges.length / 2)] : 0;
      const averageAge = sortedAges.length > 0 ? Math.round(sortedAges.reduce((s, a) => s + a, 0) / sortedAges.length * 10) / 10 : 0;

      results.push({
        year,
        inflow: Math.round(yearlyInflow),
        inflowNormal: Math.round(yearlyInflowNormal),
        inflowNew: Math.round(yearlyInflowNew),
        inflowExtension: Math.round(yearlyInflowExtension),
        inflowInterest: Math.round(yearlyInflowInterest),
        outflow: Math.round(yearlyOutflow),
        endingAsset: Math.round(currentAsset),
        activeMembers: activeCount,
        payoutMembers: payoutCount,
        totalActiveMinisters: activeMinistersCount,
        totalRetiredMinisters: retiredMinistersCount,
        actuarialLiability: Math.round(actuarialLiability),
        fundingRatio: parseFloat(fundingRatio.toFixed(2)),
        ageUnder40,
        age40s,
        age50s,
        age60s,
        age70plus,
        medianAge,
        averageAge
      });
    }

    // 2025년(results[0])의 계리 부채 및 적립률을 2026년 결과를 기준으로 할인하여 보정
    if (results.length > 1) {
      const nextLiability = results[1].actuarialLiability;
      const d = discountRate / 100;
      results[0].actuarialLiability = Math.round(nextLiability / (1 + d));
      results[0].fundingRatio = parseFloat((results[0].endingAsset / results[0].actuarialLiability * 100).toFixed(2));
      
      // 연령 분석 값도 2026년 기준 이월
      results[0].ageUnder40 = results[1].ageUnder40;
      results[0].age40s = results[1].age40s;
      results[0].age50s = results[1].age50s;
      results[0].age60s = results[1].age60s;
      results[0].age70plus = results[1].age70plus;
      results[0].medianAge = results[1].medianAge;
      results[0].averageAge = results[1].averageAge;
    }

    return results;

  };

  // 현직 목회자 연금 가입/미가입 및 수급 자격 현황 요약
  const enrollmentStats = useMemo(() => {
    if (members.length === 0) return null;

    let totalActiveMinisters = 0;
    let enrolled = 0;
    let nonEnrolled = 0;
    let enrolledEligible = 0;   // 15년 채우는 가입자
    let enrolledIneligible = 0; // 15년 못 채우는 가입자
    let nonEnrolledEligible = 0;   // 55세 이하 미가입자
    let nonEnrolledIneligible = 0; // 56세 이상 미가입자
    let nonEnrolledNoBirthday = 0; // 생년월일 불량 미가입자

    // 연령대별 가입/미가입 세부 통계
    const ageGroups = {
      under40: { enrolled: 0, nonEnrolled: 0 },
      ages40s: { enrolled: 0, nonEnrolled: 0 },
      ages50s: { enrolled: 0, nonEnrolled: 0 },
      over60: { enrolled: 0, nonEnrolled: 0 },
      unknown: { enrolled: 0, nonEnrolled: 0 }
    };

    members.forEach((m) => {
      // 은퇴하여 이미 연금을 수령 중인 수급자는 현직 통계에서 제외
      if (m.EndDate && m.EndDate.trim() !== '') {
        return;
      }

      totalActiveMinisters++;
      const birthDayTrim = m.BirthDay?.trim() || '';
      let birthYear = null;
      if (birthDayTrim.length === 8) {
        const parsed = parseInt(birthDayTrim.slice(0, 4));
        if (!isNaN(parsed) && parsed > 1900 && parsed < 2026) {
          birthYear = parsed;
        }
      }
      const age2026 = birthYear ? (2026 - birthYear) : null;
      const isEnrolled = m.PenNo !== null && m.PenNo.trim() !== '' && (m.CurrentAmt > 0 || m.PastMonths > 0);

      let groupKey: 'under40' | 'ages40s' | 'ages50s' | 'over60' | 'unknown' = 'unknown';
      if (age2026 !== null) {
        if (age2026 < 40) groupKey = 'under40';
        else if (age2026 < 50) groupKey = 'ages40s';
        else if (age2026 < 60) groupKey = 'ages50s';
        else groupKey = 'over60';
      }

      if (isEnrolled) {
        enrolled++;
        ageGroups[groupKey].enrolled++;
        if (!age2026) {
          enrolledEligible++;
        } else {
          // 70세 정년은퇴 기준 남은 연수 * 12 + 기존 납입 개월 수 >= 180
          const monthsToRetire = Math.max(0, (70 - age2026) * 12);
          if (m.PastMonths + monthsToRetire >= 180) {
            enrolledEligible++;
          } else {
            enrolledIneligible++;
          }
        }
      } else {
        nonEnrolled++;
        ageGroups[groupKey].nonEnrolled++;
        if (!age2026) {
          nonEnrolledNoBirthday++;
        } else if (age2026 <= 55) {
          nonEnrolledEligible++;
        } else {
          nonEnrolledIneligible++;
        }
      }
    });

    return {
      totalActiveMinisters,
      enrolled,
      nonEnrolled,
      enrolledEligible,
      enrolledIneligible,
      nonEnrolledEligible,
      nonEnrolledIneligible,
      nonEnrolledNoBirthday,
      ageGroups
    };
  }, [members]);


  // 기존 안 시뮬레이션 연산 (고정 기준 - 65/70세, 매년 신규 가입 40명 기본)
  const baseProjection = useMemo(() => {
    if (members.length === 0) return [];
    return runSimulation(
      BASE_VOLUNTARY_AGE,
      BASE_MANDATORY_AGE,
      interestRate,
      wageGrowth,
      maleLife,
      femaleLife,
      initialAsset,
      40,
      9.0, // 기존 기여율 9%
      3.5, // 기존 할인율 3.5%
      0.0, // 기존 보조율 0%
      20,  // 기존 자원은퇴자 비율 20% 기본값
      false
    );
  }, [members, interestRate, wageGrowth, maleLife, femaleLife, initialAsset]);

  // 제안 안 시뮬레이션 연산 (사용자 설정 슬라이더 반영 - 중위)
  const proposedProjection = useMemo(() => {
    if (members.length === 0) return [];
    return runSimulation(
      simVoluntaryAge,
      simMandatoryAge,
      interestRate,
      wageGrowth,
      maleLife,
      femaleLife,
      initialAsset,
      simNewSubscribers,
      simContributionRate,
      simDiscountRate,
      simSubsidyRate,
      voluntaryRatio,
      true
    );
  }, [members, simVoluntaryAge, simMandatoryAge, interestRate, wageGrowth, maleLife, femaleLife, initialAsset, simNewSubscribers, simNewSubDeclineRate, lifeExpectancyTrend, nonSelfSufficientRatio, simCpiIndexing, simCpiRate, simLumpSumRatio, simContributionRate, simDiscountRate, simSubsidyRate, voluntaryRatio]);

  // 제안 안 시뮬레이션 연산 (낙관 - 수익률 + 변동성)
  const proposedProjectionOpt = useMemo(() => {
    if (members.length === 0) return [];
    return runSimulation(
      simVoluntaryAge,
      simMandatoryAge,
      interestRate + interestVolatility,
      wageGrowth,
      maleLife,
      femaleLife,
      initialAsset,
      simNewSubscribers,
      simContributionRate,
      simDiscountRate,
      simSubsidyRate,
      voluntaryRatio,
      true
    );
  }, [members, simVoluntaryAge, simMandatoryAge, interestRate, interestVolatility, wageGrowth, maleLife, femaleLife, initialAsset, simNewSubscribers, simNewSubDeclineRate, lifeExpectancyTrend, nonSelfSufficientRatio, simCpiIndexing, simCpiRate, simLumpSumRatio, simContributionRate, simDiscountRate, simSubsidyRate, voluntaryRatio]);

  // 제안 안 시뮬레이션 연산 (비관 - 수익률 - 변동성)
  const proposedProjectionPess = useMemo(() => {
    if (members.length === 0) return [];
    return runSimulation(
      simVoluntaryAge,
      simMandatoryAge,
      interestRate - interestVolatility,
      wageGrowth,
      maleLife,
      femaleLife,
      initialAsset,
      simNewSubscribers,
      simContributionRate,
      simDiscountRate,
      simSubsidyRate,
      voluntaryRatio,
      true
    );
  }, [members, simVoluntaryAge, simMandatoryAge, interestRate, interestVolatility, wageGrowth, maleLife, femaleLife, initialAsset, simNewSubscribers, simNewSubDeclineRate, lifeExpectancyTrend, nonSelfSufficientRatio, simCpiIndexing, simCpiRate, simLumpSumRatio, simContributionRate, simDiscountRate, simSubsidyRate, voluntaryRatio]);

  // 수지적자 전환 연도 찾기 (흑자 → 적자 전환 시점 또는 처음부터 적자인 경우 구분)
  const baseDeficitInfo = useMemo(() => {
    if (baseProjection.length === 0) return { type: 'no-data' as const, year: null };
    // 첫 해부터 적자인지 확인
    const firstYear = baseProjection[0];
    if (firstYear.inflow < firstYear.outflow) {
      // 혹시 중간에 흑자 전환하는 해가 있는지 확인
      const surplusYear = baseProjection.find((p) => p.inflow >= p.outflow);
      if (surplusYear) {
        // 흑자 전환 후 다시 적자로 전환하는 해 찾기
        const afterSurplusIdx = baseProjection.indexOf(surplusYear);
        const deficitAfterSurplus = baseProjection.slice(afterSurplusIdx).find((p) => p.inflow < p.outflow);
        return { type: 'recovers-then-deficit' as const, year: deficitAfterSurplus ? deficitAfterSurplus.year : null, surplusYear: surplusYear.year };
      }
      return { type: 'always-deficit' as const, year: firstYear.year };
    }
    // 처음에는 흑자, 적자 전환 시점 찾기
    const deficit = baseProjection.find((p) => p.inflow < p.outflow);
    return { type: 'transition' as const, year: deficit ? deficit.year : null };
  }, [baseProjection]);

  const proposedDeficitInfo = useMemo(() => {
    if (proposedProjection.length === 0) return { type: 'no-data' as const, year: null };
    const firstYear = proposedProjection[0];
    if (firstYear.inflow < firstYear.outflow) {
      const surplusYear = proposedProjection.find((p) => p.inflow >= p.outflow);
      if (surplusYear) {
        const afterSurplusIdx = proposedProjection.indexOf(surplusYear);
        const deficitAfterSurplus = proposedProjection.slice(afterSurplusIdx).find((p) => p.inflow < p.outflow);
        return { type: 'recovers-then-deficit' as const, year: deficitAfterSurplus ? deficitAfterSurplus.year : null, surplusYear: surplusYear.year };
      }
      return { type: 'always-deficit' as const, year: firstYear.year };
    }
    const deficit = proposedProjection.find((p) => p.inflow < p.outflow);
    return { type: 'transition' as const, year: deficit ? deficit.year : null };
  }, [proposedProjection]);

  // 하위 호환성을 위한 alias
  const baseDeficitYear = baseDeficitInfo.type === 'transition' ? baseDeficitInfo.year : (baseDeficitInfo.type === 'always-deficit' ? baseDeficitInfo.year : null);
  const proposedDeficitYear = proposedDeficitInfo.type === 'transition' ? proposedDeficitInfo.year : (proposedDeficitInfo.type === 'always-deficit' ? proposedDeficitInfo.year : null);

  // 기존 안 고갈 연도 찾기
  const baseDepletionYear = useMemo(() => {
    const depleted = baseProjection.find((p) => p.endingAsset < 0);
    return depleted ? depleted.year : null;
  }, [baseProjection]);

  // 제안 안 고갈 연도 찾기
  const proposedDepletionYear = useMemo(() => {
    const depleted = proposedProjection.find((p) => p.endingAsset < 0);
    return depleted ? depleted.year : null;
  }, [proposedProjection]);

  // 제안 안 낙관 고갈 연도 찾기
  const proposedDepletionYearOpt = useMemo(() => {
    const depleted = proposedProjectionOpt.find((p) => p.endingAsset < 0);
    return depleted ? depleted.year : null;
  }, [proposedProjectionOpt]);

  // 제안 안 비관 고갈 연도 찾기
  const proposedDepletionYearPess = useMemo(() => {
    const depleted = proposedProjectionPess.find((p) => p.endingAsset < 0);
    return depleted ? depleted.year : null;
  }, [proposedProjectionPess]);

  // 10개년 단기 재정 전망 (제안안 기준)
  const shortTermLabels = useMemo(() => {
    return proposedProjection.slice(0, 10).map((p) => `${p.year}년`);
  }, [proposedProjection]);

  // 단기 재정 전망 범례 하이라이트 스타일 함수
  const getShortTermColor = (idx: number, opacityType: 'border' | 'background') => {
    const baseColors = [
      '59, 130, 246',    // 기금 잔액
      '34, 197, 94',     // 총 수입
      '239, 68, 68',     // 연간 지출
      '245, 158, 11'     // 은퇴 수급자 수
    ];
    const defaultBgOpacities = [0.05, 0.35, 0.35, 0];
    const defaultBorderOpacities = [1.0, 0.75, 0.75, 1.0];
    
    const baseColor = baseColors[idx];
    
    if (highlightedShortTermIndices.length === 0) {
      return opacityType === 'background'
        ? `rgba(${baseColor}, ${defaultBgOpacities[idx]})`
        : `rgba(${baseColor}, ${defaultBorderOpacities[idx]})`;
    }
    
    if (highlightedShortTermIndices.includes(idx)) {
      return opacityType === 'background'
        ? `rgba(${baseColor}, ${idx === 3 ? 0.05 : 0.5})`
        : `rgba(${baseColor}, 1)`;
    } else {
      return opacityType === 'background'
        ? 'transparent'
        : `rgba(${baseColor}, 0.12)`;
    }
  };

  const getShortTermWidth = (idx: number) => {
    const defaultWidths = [3.5, 1.5, 1.5, 2.5];
    if (highlightedShortTermIndices.length === 0) {
      return defaultWidths[idx];
    }
    return highlightedShortTermIndices.includes(idx) ? defaultWidths[idx] + 2.0 : 0.8;
  };

  const shortTermChartData = useMemo(() => {
    const sliceData = proposedProjection.slice(0, 10);
    return {
      labels: shortTermLabels,
      datasets: [
        {
          type: 'line' as const,
          label: '기금 잔액 (좌측 Y축, 억 원)',
          data: sliceData.map((p) => Math.round(p.endingAsset / 100000000)),
          borderColor: getShortTermColor(0, 'border'),
          backgroundColor: getShortTermColor(0, 'background'),
          borderWidth: getShortTermWidth(0),
          yAxisID: 'yAmount',
          tension: 0.15,
          order: 1,
        },
        {
          type: 'bar' as const,
          label: '총 수입 (좌측 Y축, 억 원)',
          data: sliceData.map((p) => Math.round((p.inflow + p.inflowInterest) / 100000000)),
          backgroundColor: getShortTermColor(1, 'background'),
          borderColor: getShortTermColor(1, 'border'),
          borderWidth: getShortTermWidth(1),
          yAxisID: 'yAmount',
          order: 2,
        },
        {
          type: 'bar' as const,
          label: '연간 지출 (좌측 Y축, 억 원)',
          data: sliceData.map((p) => Math.round(p.outflow / 100000000)),
          backgroundColor: getShortTermColor(2, 'background'),
          borderColor: getShortTermColor(2, 'border'),
          borderWidth: getShortTermWidth(2),
          yAxisID: 'yAmount',
          order: 3,
        },
        {
          type: 'line' as const,
          label: '은퇴 수급자 수 (우측 Y축, 명)',
          data: sliceData.map((p) => p.payoutMembers),
          borderColor: getShortTermColor(3, 'border'),
          backgroundColor: getShortTermColor(3, 'background'),
          borderWidth: getShortTermWidth(3),
          pointRadius: 4,
          pointBackgroundColor: getShortTermColor(3, 'border'),
          yAxisID: 'yPeople',
          tension: 0.1,
          order: 0,
        }
      ]
    };
  }, [proposedProjection, shortTermLabels, highlightedShortTermIndices]);

  const shortTermChartOptions: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        onClick: function (e, legendItem, legend) {
          const index = legendItem.datasetIndex;
          if (index !== undefined) {
            setHighlightedShortTermIndices((prev) => 
              prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
            );
          }
        },
        labels: {
          color: '#f8fafc',
          font: { family: 'var(--font-family)', weight: 'bold', size: 12 }
        }
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const val = context.parsed.y;
            const formatted = val !== null && val !== undefined ? val.toLocaleString() : 0;
            if (context.dataset.yAxisID === 'yPeople') {
              return `${context.dataset.label}: ${formatted} 명`;
            }
            return `${context.dataset.label}: ${formatted} 억 원`;
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          drag: {
            enabled: true,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderColor: 'rgba(59, 130, 246, 0.4)',
            borderWidth: 1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: { color: '#cbd5e1', font: { family: 'var(--font-family)', size: 11 } }
      },
      yAmount: {
        type: 'linear' as const,
        position: 'left' as const,
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: {
          color: '#cbd5e1',
          font: { family: 'var(--font-family)', size: 11 },
          callback: function (value) {
            return `${Number(value).toLocaleString()}억`;
          }
        },
        title: {
          display: true,
          text: '금액 (억 원)',
          color: '#cbd5e1',
          font: { family: 'var(--font-family)', size: 11, weight: 'bold' }
        }
      },
      yPeople: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: {
          color: 'hsl(38, 92%, 60%)',
          font: { family: 'var(--font-family)', size: 11 },
          callback: function (value) {
            return `${Number(value).toLocaleString()}명`;
          }
        },
        title: {
          display: true,
          text: '수급자 수 (명)',
          color: 'hsl(38, 92%, 60%)',
          font: { family: 'var(--font-family)', size: 11, weight: 'bold' }
        }
      }
    }
  };
  // 차트 범례 하이라이트 스타일 함수
  const getAssetStyle = (idx: number, isBorder: boolean) => {
    const colors = [
      '346, 84%, 61%',  // 기존 안 자산 (0)
      '142, 70%, 45%',  // 낙관 자산 (1)
      '222, 89%, 65%',  // 중위 자산 (2)
      '28, 90%, 55%',    // 비관 자산 (3)
      '200, 10%, 70%',   // 기존 안 적립률 (4)
      '330, 85%, 60%'    // 제안 안 적립률 (5)
    ];
    const defaultWidths = [2, 1.5, 3, 1.5, 1.5, 2.5];
    const baseColor = colors[idx];
    
    if (highlightedAssetIndices.length === 0) {
      if (isBorder) return defaultWidths[idx];
      return `hsla(${baseColor}, ${idx === 2 ? 0.06 : 0})`;
    }
    
    if (highlightedAssetIndices.includes(idx)) {
      if (isBorder) return defaultWidths[idx] + 2.0; // 하이라이트 시 두껍게 강조
      return `hsla(${baseColor}, ${idx === 2 ? 0.15 : 0.05})`;
    } else {
      if (isBorder) return 0.8; // 하이라이트 안 됨 시 흐리게 가늘게
      return 'transparent';
    }
  };

  const getAssetColor = (idx: number) => {
    const colors = [
      '346, 84%, 61%',  // 기존 안 자산 (0)
      '142, 70%, 45%',  // 낙관 자산 (1)
      '222, 89%, 65%',  // 중위 자산 (2)
      '28, 90%, 55%',    // 비관 자산 (3)
      '200, 10%, 70%',   // 기존 안 적립률 (4)
      '330, 85%, 60%'    // 제안 안 적립률 (5)
    ];
    const baseColor = colors[idx];
    if (highlightedAssetIndices.length === 0) {
      return `hsla(${baseColor}, 1)`;
    }
    return highlightedAssetIndices.includes(idx) ? `hsla(${baseColor}, 1)` : `hsla(${baseColor}, 0.12)`;
  };

  // 차트 데이터 셋업
  const yearsLabels = baseProjection.map((p) => `${p.year}년`);
  const baseAssetsPoints = baseProjection.map((p) => Math.round(p.endingAsset / 100000000)); // 억 원 단위
  const proposedAssetsPoints = proposedProjection.map((p) => Math.round(p.endingAsset / 100000000)); // 억 원 단위
  const proposedAssetsPointsOpt = proposedProjectionOpt.map((p) => Math.round(p.endingAsset / 100000000)); // 억 원 단위
  const proposedAssetsPointsPess = proposedProjectionPess.map((p) => Math.round(p.endingAsset / 100000000)); // 억 원 단위
  const baseFundingRatioPoints = baseProjection.map((p) => p.fundingRatio);
  const proposedFundingRatioPoints = proposedProjection.map((p) => p.fundingRatio);

  const chartData: ChartData<'line'> = {
    labels: yearsLabels,
    datasets: [
      {
        label: '기존 안 자산 (좌측 Y축, 억 원)',
        data: baseAssetsPoints,
        borderColor: getAssetColor(0),
        borderWidth: getAssetStyle(0, true) as number,
        borderDash: [5, 5],
        backgroundColor: getAssetStyle(0, false) as string,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      },
      {
        label: '제안 안 자산 (낙관) (좌측 Y축, 억 원)',
        data: proposedAssetsPointsOpt,
        borderColor: getAssetColor(1),
        borderWidth: getAssetStyle(1, true) as number,
        borderDash: [3, 3],
        backgroundColor: getAssetStyle(1, false) as string,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      },
      {
        label: '제안 안 자산 (중위) (좌측 Y축, 억 원)',
        data: proposedAssetsPoints,
        borderColor: getAssetColor(2),
        borderWidth: getAssetStyle(2, true) as number,
        backgroundColor: getAssetStyle(2, false) as string,
        fill: true,
        pointRadius: 0,
        tension: 0.1,
        yAxisID: 'y',
      },
      {
        label: '제안 안 자산 (비관) (좌측 Y축, 억 원)',
        data: proposedAssetsPointsPess,
        borderColor: getAssetColor(3),
        borderWidth: getAssetStyle(3, true) as number,
        borderDash: [3, 3],
        backgroundColor: getAssetStyle(3, false) as string,
        pointRadius: 0,
        tension: 0.1,
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        onClick: function (e, legendItem, legend) {
          const index = legendItem.datasetIndex;
          if (index !== undefined) {
            setHighlightedAssetIndices((prev) => 
              prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
            );
          }
        },
        labels: {
          color: '#f8fafc', // Slate 50 (매우 밝은 흰회색)
          font: {
            family: 'var(--font-family)',
            weight: 'bold',
            size: 13
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const val = context.parsed.y;
            const formatted = val !== null && val !== undefined ? val.toLocaleString() : 0;
            return `${context.dataset.label}: ${formatted} 억 원`;
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          drag: {
            enabled: true,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderColor: 'rgba(59, 130, 246, 0.4)',
            borderWidth: 1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: { 
          color: '#cbd5e1', // Slate 300 (가독성 높은 연회색)
          font: { family: 'var(--font-family)', size: 11 }
        }
      },
      y: {
        grid: {
          color: function(context) {
            if (context.tick && context.tick.value === 0) {
              return 'rgba(239, 68, 68, 0.85)'; // 0억 고갈선 강조
            }
            return 'rgba(255, 255, 255, 0.08)';
          },
          lineWidth: function(context) {
            if (context.tick && context.tick.value === 0) {
              return 2.5;
            }
            return 1;
          }
        },
        ticks: {
          color: function(context) {
            const val = context.tick ? Number(context.tick.value) : 0;
            if (val < 0) {
              return '#f87171'; // 적자는 밝은 적색
            }
            if (val === 0) {
              return '#fbbf24'; // 고갈선은 황색
            }
            return '#cbd5e1';
          },
          font: { family: 'var(--font-family)', size: 11, weight: 'bold' },
          callback: function (value) {
            const val = Number(value);
            if (val < 0) {
              return `적자 -${Math.abs(val)}억 (고갈)`;
            } else if (val === 0) {
              return '0억 (고갈 기준선)';
            }
            return `${val.toLocaleString()}억`;
          }
        }
      }
    }
  };

  // 목회자 수 차트 범례 하이라이트 스타일 함수
  const getMinistersColor = (idx: number) => {
    const colors = [
      '148, 163, 184',       // 기존 안 납입자 (Slate)
      '59, 130, 246',        // 제안 안 납입자 (로얄 블루)
      '239, 68, 68',         // 기존 안 수급자 (적색)
      '244, 63, 94'          // 제안 안 수급자 (로즈)
    ];
    const baseColor = colors[idx];
    const baseOpacity = idx === 0 ? 0.6 : (idx === 2 ? 0.5 : 1.0);
    
    if (highlightedMinistersIndices.length === 0) {
      return `rgba(${baseColor}, ${baseOpacity})`;
    }
    return highlightedMinistersIndices.includes(idx) ? `rgba(${baseColor}, 1)` : `rgba(${baseColor}, 0.12)`;
  };

  const getMinistersWidth = (idx: number) => {
    const defaultWidths = [2, 3, 2, 3];
    if (highlightedMinistersIndices.length === 0) {
      return defaultWidths[idx];
    }
    return highlightedMinistersIndices.includes(idx) ? defaultWidths[idx] + 2.0 : 0.8;
  };

  // 교단 목회자 총수 차트 범례 하이라이트 스타일 함수
  const getTotalMinistersColor = (idx: number) => {
    const colors = [
      '148, 163, 184',       // 기존 안 현직 (Slate)
      '59, 130, 246',        // 제안 안 현직 (로얄 블루)
      '239, 68, 68',         // 기존 안 은퇴 (적색)
      '244, 63, 94',         // 제안 안 은퇴 (로즈)
      '168, 85, 247'         // 교단 총 목회자 (퍼플)
    ];
    const baseColor = colors[idx];
    const baseOpacity = idx === 0 ? 0.6 : (idx === 2 ? 0.5 : (idx === 4 ? 0.8 : 1.0));
    
    if (highlightedTotalMinistersIndices.length === 0) {
      return `rgba(${baseColor}, ${baseOpacity})`;
    }
    return highlightedTotalMinistersIndices.includes(idx) ? `rgba(${baseColor}, 1)` : `rgba(${baseColor}, 0.12)`;
  };

  const getTotalMinistersWidth = (idx: number) => {
    const defaultWidths = [2, 3, 2, 3, 2.5];
    if (highlightedTotalMinistersIndices.length === 0) {
      return defaultWidths[idx];
    }
    return highlightedTotalMinistersIndices.includes(idx) ? defaultWidths[idx] + 2.0 : 0.8;
  };

  const ministersChartData: ChartData<'line'> = {
    labels: yearsLabels,
    datasets: [
      {
        label: '기존 안 납입자 (65/70세, 신규40명)',
        data: baseProjection.map((p) => p.activeMembers),
        borderColor: getMinistersColor(0),
        borderDash: [4, 4],
        borderWidth: getMinistersWidth(0),
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.15,
      },
      {
        label: '제안 안 납입자 (조정 시나리오)',
        data: proposedProjection.map((p) => p.activeMembers),
        borderColor: getMinistersColor(1),
        borderWidth: getMinistersWidth(1),
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.15,
      },
      {
        label: '기존 안 수급자 (65/70세, 신규40명)',
        data: baseProjection.map((p) => p.payoutMembers),
        borderColor: getMinistersColor(2),
        borderDash: [4, 4],
        borderWidth: getMinistersWidth(2),
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.15,
      },
      {
        label: '제안 안 수급자 (조정 시나리오)',
        data: proposedProjection.map((p) => p.payoutMembers),
        borderColor: getMinistersColor(3),
        borderWidth: getMinistersWidth(3),
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.15,
      }
    ]
  };

  const ministersChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        onClick: function (e, legendItem, legend) {
          const index = legendItem.datasetIndex;
          if (index !== undefined) {
            setHighlightedMinistersIndices((prev) => 
              prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
            );
          }
        },
        labels: {
          color: '#f8fafc',
          font: { family: 'var(--font-family)', weight: 'bold', size: 12 }
        }
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const val = context.parsed.y;
            const formatted = val !== null && val !== undefined ? val.toLocaleString() : 0;
            return `${context.dataset.label}: ${formatted} 명`;
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          drag: {
            enabled: true,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderColor: 'rgba(59, 130, 246, 0.4)',
            borderWidth: 1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: { color: '#cbd5e1', font: { family: 'var(--font-family)', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: {
          color: '#cbd5e1',
          font: { family: 'var(--font-family)', size: 11 },
          callback: function (value) {
            return `${Number(value).toLocaleString()}명`;
          }
        }
      }
    }
  };

  const totalMinistersChartData: ChartData<'line'> = {
    labels: yearsLabels,
    datasets: [
      {
        label: '기존 안 현직 목회자 (65/70세, 신규40명)',
        data: baseProjection.map((p) => p.totalActiveMinisters || 0),
        borderColor: getTotalMinistersColor(0),
        borderDash: [4, 4],
        borderWidth: getTotalMinistersWidth(0),
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.15,
      },
      {
        label: '제안 안 현직 목회자 (조정 시나리오)',
        data: proposedProjection.map((p) => p.totalActiveMinisters || 0),
        borderColor: getTotalMinistersColor(1),
        borderWidth: getTotalMinistersWidth(1),
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.15,
      },
      {
        label: '기존 안 은퇴 목회자 (65/70세, 신규40명)',
        data: baseProjection.map((p) => p.totalRetiredMinisters || 0),
        borderColor: getTotalMinistersColor(2),
        borderDash: [4, 4],
        borderWidth: getTotalMinistersWidth(2),
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.15,
      },
      {
        label: '제안 안 은퇴 목회자 (조정 시나리오)',
        data: proposedProjection.map((p) => p.totalRetiredMinisters || 0),
        borderColor: getTotalMinistersColor(3),
        borderWidth: getTotalMinistersWidth(3),
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.15,
      },
      {
        label: '교단 총 목회자 수 (현직 + 은퇴)',
        data: proposedProjection.map((p) => (p.totalActiveMinisters || 0) + (p.totalRetiredMinisters || 0)),
        borderColor: getTotalMinistersColor(4),
        borderWidth: getTotalMinistersWidth(4),
        borderDash: [2, 2],
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.15,
      }
    ]
  };

  const totalMinistersChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        onClick: function (e, legendItem, legend) {
          const index = legendItem.datasetIndex;
          if (index !== undefined) {
            setHighlightedTotalMinistersIndices((prev) => 
              prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
            );
          }
        },
        labels: {
          color: '#f8fafc',
          font: { family: 'var(--font-family)', weight: 'bold', size: 12 }
        }
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const val = context.parsed.y;
            const formatted = val !== null && val !== undefined ? val.toLocaleString() : 0;
            return `${context.dataset.label}: ${formatted} 명`;
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          drag: {
            enabled: true,
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderColor: 'rgba(59, 130, 246, 0.4)',
            borderWidth: 1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: { color: '#cbd5e1', font: { family: 'var(--font-family)', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        ticks: {
          color: '#cbd5e1',
          font: { family: 'var(--font-family)', size: 11 },
          callback: function (value) {
            return `${Number(value).toLocaleString()}명`;
          }
        }
      }
    }
  };

  const renderSimulatorControls = (isDrawer = false) => {
    return (
      <section className={isDrawer ? "" : "glass-panel"} style={{ 
        display: !isDrawer && (mode === 'viewer' || mode.startsWith('chart-')) ? 'none' : 'flex', 
        flexDirection: 'column', 
        gap: '1.5rem', 
        width: '100%',
        padding: isDrawer ? '1.5rem' : '2rem',
        background: isDrawer ? 'transparent' : 'var(--bg-glass)',
        border: isDrawer ? 'none' : '1px solid var(--border-color)',
        borderRadius: isDrawer ? '0' : '12px',
        overflowY: isDrawer ? 'auto' : 'visible',
        maxHeight: isDrawer ? 'calc(100vh - 120px)' : 'none'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
            정책 시뮬레이션 설정
          </h2>
          {!isDrawer && (
            <button
              onClick={handleOpenDualMode}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                background: 'var(--primary-glow)',
                border: '1px solid var(--primary)',
                borderRadius: '6px',
                color: 'var(--primary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--primary-glow)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
            >
              🖥️ 별도창 열기 (듀얼 모니터)
            </button>
          )}
        </div>
        {!isDrawer && (
          <div style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '4px', color: 'var(--danger)', marginTop: '-0.5rem' }}>
            ※ [별도창 열기] 클릭 시 새 창이 나타나지 않으면, 브라우저 주소창 우측에서 <strong>팝업 차단을 항상 허용</strong>으로 설정해 주세요.
          </div>
        )}

        {/* 1. 자원 은퇴 나이 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">자원 은퇴 나이</span>
            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{simVoluntaryAge} 세</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={60}
            max={70}
            value={simVoluntaryAge}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSimVoluntaryAge(val);
              if (val >= simMandatoryAge) setSimMandatoryAge(val + 3);
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>60세</span>
            <span>65세 (기본)</span>
            <span>70세</span>
          </div>
        </div>

        {/* 2. 정년 은퇴 나이 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">정년 은퇴 나이</span>
            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{simMandatoryAge} 세</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={65}
            max={78}
            value={simMandatoryAge}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSimMandatoryAge(val);
              if (val <= simVoluntaryAge) setSimVoluntaryAge(val - 3);
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>65세</span>
            <span>70세 (기본)</span>
            <span>78세</span>
          </div>
        </div>

        {/* 3. 자원 은퇴 비율 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">자원 은퇴자 선택 비율</span>
            <span style={{ fontWeight: '700' }}>{voluntaryRatio} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={100}
            step={5}
            value={voluntaryRatio}
            onChange={(e) => setVoluntaryRatio(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0% (전원 정년)</span>
            <span>20% (보통)</span>
            <span>100% (전원 조기)</span>
          </div>
        </div>

        {/* 3.5 신규 가입자 유치 수 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">매년 신규 목회자 가입 유치 수</span>
            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{simNewSubscribers} 명</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={100}
            step={1}
            value={simNewSubscribers}
            onChange={(e) => setSimNewSubscribers(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0명</span>
            <span>40명 (기본)</span>
            <span>100명</span>
          </div>
        </div>

        {/* 4. 기금수익률 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">재단 기금 연 운용수익률</span>
            <span style={{ fontWeight: '700', color: 'var(--success)' }}>{interestRate.toFixed(1)} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={8}
            step={0.1}
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0% (수익 없음)</span>
            <span>3.7% (기본)</span>
            <span>8.0% (고수익)</span>
          </div>
        </div>

        {/* 5. 임금 상승률 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">연 기본급 인상률 (임금상승률)</span>
            <span style={{ fontWeight: '700' }}>{wageGrowth.toFixed(1)} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={5}
            step={0.1}
            value={wageGrowth}
            onChange={(e) => setWageGrowth(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0% (기본급 동결)</span>
            <span>1.5% (기본)</span>
            <span>5.0%</span>
          </div>
        </div>

        {/* 6. 남성 평균 수명 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">목회자 (남성) 평균 수명</span>
            <span style={{ fontWeight: '700' }}>{maleLife} 세</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={75}
            max={95}
            value={maleLife}
            onChange={(e) => setMaleLife(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>75세</span>
            <span>81세 (기본)</span>
            <span>95세</span>
          </div>
        </div>

        {/* 7. 여성 평균 수명 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">배우자 (여성) 평균 수명</span>
            <span style={{ fontWeight: '700' }}>{femaleLife} 세</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={75}
            max={100}
            value={femaleLife}
            onChange={(e) => setFemaleLife(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>75세</span>
            <span>87세 (기본)</span>
            <span>100세</span>
          </div>
        </div>

        {/* 8. 초기 재단 자산 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">초기 재단 보유 자산</span>
            <span style={{ fontWeight: '700' }}>{(initialAsset / 100000000).toLocaleString()} 억 원</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={10000000000}
            max={150000000000}
            step={5000000000}
            value={initialAsset}
            onChange={(e) => setInitialAsset(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>100억 원</span>
            <span>494억 원 (기본)</span>
            <span>1500억 원</span>
          </div>
        </div>

        {/* 8.5 보험료율(기여율) */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">기여율 (보험료율)</span>
            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{simContributionRate.toFixed(1)} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={6.0}
            max={15.0}
            step={0.5}
            value={simContributionRate}
            onChange={(e) => setSimContributionRate(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>6.0%</span>
            <span>9.0% (기본)</span>
            <span>15.0%</span>
          </div>
        </div>

        {/* 8.6 미자립교회 재정보조율 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label">미자립 교회 재정보조율</span>
            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{simSubsidyRate.toFixed(0)} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={100}
            step={5}
            value={simSubsidyRate}
            onChange={(e) => setSimSubsidyRate(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0% (보조 없음)</span>
            <span>50%</span>
            <span>100% (완전 보조)</span>
          </div>
        </div>

        {/* 구분선 */}
        <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '1.5rem 0' }} />

        <h3 style={{ fontSize: '1.1rem', color: 'var(--warning)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          ⚙️ 6대 고급 리스크 시나리오 설정
        </h3>

        {/* 1. 신규 가입자 감소율 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📉 신규 가입자 감소율 (저출생)
            </span>
            <span style={{ fontWeight: '700', color: 'var(--danger)' }}>{simNewSubDeclineRate.toFixed(1)} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={5}
            step={0.1}
            value={simNewSubDeclineRate}
            onChange={(e) => setSimNewSubDeclineRate(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0% (감소 없음)</span>
            <span>1.5% (기본)</span>
            <span>5.0%</span>
          </div>
        </div>

        {/* 2. 투자 수익률 변동성 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📊 투자 수익률 변동성 (신뢰대역)
            </span>
            <span style={{ fontWeight: '700', color: 'var(--primary)' }}>± {interestVolatility.toFixed(1)} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={5}
            step={0.1}
            value={interestVolatility}
            onChange={(e) => setInterestVolatility(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0% (고정)</span>
            <span>1.0% (기본)</span>
            <span>5.0%</span>
          </div>
        </div>

        {/* 3. 고령화 기대수명 상승률 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📈 고령화 수명 연장 속도
            </span>
            <span style={{ fontWeight: '700' }}>+{lifeExpectancyTrend.toFixed(2)} 세/10년</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={1}
            step={0.05}
            value={lifeExpectancyTrend}
            onChange={(e) => setLifeExpectancyTrend(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0세 (정체)</span>
            <span>0.15세 (기본)</span>
            <span>1.0세</span>
          </div>
        </div>

        {/* 4. 미자립 교회 비율 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              ⛪ 미자립 교회 비율 (완납율 연동)
            </span>
            <span style={{ fontWeight: '700' }}>{nonSelfSufficientRatio} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={50}
            step={5}
            value={nonSelfSufficientRatio}
            onChange={(e) => setNonSelfSufficientRatio(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0% (완납 90.0%)</span>
            <span>30% (완납 83.1%)</span>
            <span>50% (완납 78.5%)</span>
          </div>
        </div>

        {/* 5. 물가 연동 지급액 인상 */}
        <div className="form-group" style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              checked={simCpiIndexing}
              onChange={(e) => setSimCpiIndexing(e.target.checked)}
              style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer', accentColor: 'var(--warning)' }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              물가 연동 지급액 인상 (CPI Indexing)
            </span>
          </label>
          {simCpiIndexing && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>연평균 물가상승률(CPI)</span>
                <span style={{ fontWeight: '700', color: 'var(--warning)' }}>{simCpiRate.toFixed(1)} %</span>
              </div>
              <input
                type="range"
                className="slider-input"
                min={0.5}
                max={5}
                step={0.1}
                value={simCpiRate}
                onChange={(e) => setSimCpiRate(Number(e.target.value))}
                style={{ marginTop: '0.25rem' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.675rem', color: 'var(--text-tertiary)' }}>
                <span>0.5%</span>
                <span>1.5% (기본)</span>
                <span>5.0%</span>
              </div>
            </div>
          )}
        </div>

        {/* 6. 일시금 수령 퇴출 비율 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              💰 은퇴 시 일시금 수령 비율
            </span>
            <span style={{ fontWeight: '700', color: 'var(--danger)' }}>{simLumpSumRatio} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={0}
            max={20}
            step={1}
            value={simLumpSumRatio}
            onChange={(e) => setSimLumpSumRatio(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>0% (전원 연금)</span>
            <span>5% (기본)</span>
            <span>20% (높음)</span>
          </div>
        </div>

        {/* 7. 수리적 계리 할인율 가정 */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              📉 수리적 할인율 가정 (Discount Rate)
            </span>
            <span style={{ fontWeight: '700', color: 'var(--warning)' }}>{simDiscountRate.toFixed(1)} %</span>
          </div>
          <input
            type="range"
            className="slider-input"
            min={2.0}
            max={6.0}
            step={0.1}
            value={simDiscountRate}
            onChange={(e) => setSimDiscountRate(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-tertiary)' }}>
            <span>2.0% (비관/저금리)</span>
            <span>3.5% (기본)</span>
            <span>6.0% (낙관/고금리)</span>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: mode === 'control' ? '1rem' : '2rem' }}>
      {/* 듀얼 스크린 제어판 전용 헤더 */}
      {mode === 'control' && (
        <header className="glass-panel animate-fade-in" style={{ borderLeft: '4px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0', padding: '1rem 1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🎛️ 시뮬레이터 제어판
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>수치를 변경하면 다른 화면의 차트가 실시간으로 변합니다.</p>
          </div>
          <button 
            onClick={() => {
              if (bc.current) {
                bc.current.postMessage({ type: 'restore-normal' });
              }
              window.close();
            }}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              fontWeight: '700',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: 'var(--danger)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--danger)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
          >
            제어판 닫기
          </button>
        </header>
      )}

      {/* 듀얼 스크린 차트 뷰어 전용 헤더 */}
      {mode.startsWith('chart-') && (
        <header className="glass-panel animate-fade-in" style={{ borderLeft: '4px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0', padding: '1rem 1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🖥️ 단독 차트 화면 (실시간 동기화)
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>제어판에서 수치를 변경하면 이 차트가 실시간으로 갱신됩니다.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={() => setIsDrawerOpen(true)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                background: 'var(--primary-glow)',
                border: '1px solid var(--primary)',
                borderRadius: '6px',
                color: 'var(--primary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--primary-glow)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
            >
              📱 화면 내 시뮬레이터 열기
            </button>
            <button 
              onClick={handleOpenDualMode}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              🖥️ 설정 제어 팝업창 열기
            </button>
            <button 
              onClick={() => window.close()}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                color: 'var(--danger)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--danger)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = 'var(--danger)';
              }}
            >
              차트 화면 닫기
            </button>
          </div>
        </header>
      )}

      {/* Top Heading Panel */}
      {mode !== 'control' && !mode.startsWith('chart-') && (
        <header className="glass-panel" style={{ borderLeft: '4px solid var(--warning)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              연금기금 시뮬레이터
              {mode === 'viewer' && (
                <span style={{ fontSize: '0.9rem', color: 'var(--primary)', background: 'var(--primary-glow)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid var(--primary)', fontWeight: '700' }}>
                  🖥️ 듀얼 모니터 뷰어 모드
                </span>
              )}
            </h1>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => window.open('/committee/paper', '_blank')}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: '700',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              📄 해설서 인쇄/PDF
            </button>

            {mode === 'normal' ? (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    background: 'var(--primary-glow)',
                    border: '1px solid var(--primary)',
                    borderRadius: '6px',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--primary-glow)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                >
                  📱 화면 내 시뮬레이터 열기
                </button>
                <button
                  onClick={handleOpenDualMode}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#cbd5e1';
                  }}
                >
                  🖥️ 설정창 분리 (듀얼 모니터)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    background: 'var(--primary-glow)',
                    border: '1px solid var(--primary)',
                    borderRadius: '6px',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--primary-glow)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                >
                  📱 화면 내 시뮬레이터 열기
                </button>
                <button
                  onClick={handleOpenDualMode}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#cbd5e1';
                  }}
                >
                  🖥️ 설정 제어 팝업창 열기
                </button>
                <button
                  onClick={handleRestoreNormalMode}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#cbd5e1';
                  }}
                >
                  🔙 통합 대시보드로 복귀
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      {/* 1. CHART AREA WIDE (TOP) */}
      <section className="glass-panel animate-fade-in" style={{ width: '100%', minHeight: mode === 'chart-asset' ? '80vh' : '450px', display: (mode === 'control' || (mode.startsWith('chart-') && mode !== 'chart-asset')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>기금 잔액 추이 비교 프로젝션</h2>
            <p className="sub-title" style={{ fontSize: '0.85rem' }}>은퇴 연령 연장이 기금 수명에 미치는 복합 영향을 억 원 단위로 시각화합니다.</p>
          </div>
          
          {/* Quick Metrics & Controls */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Chart Split Button */}
            {!mode.startsWith('chart-') && (
              <button 
                onClick={() => window.open('/committee?mode=chart-asset', 'ChartAsset', 'width=1000,height=650,scrollbars=yes,resizable=yes')}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  background: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  borderRadius: '6px',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--primary-glow)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
              >
                🖥️ 차트 창 분리
              </button>
            )}

            {/* Reset Zoom Button */}
            <button 
              onClick={handleResetAssetZoom}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                fontWeight: '600',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              🔍 배율 초기화
            </button>

            <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>기존안 고갈시점</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--danger)', marginTop: '0.1rem' }}>
                {baseDepletionYear ? `${baseDepletionYear}년` : '고갈 없음'}
              </div>
            </div>
            <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>제안안 고갈시점 (중위)</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--primary)', marginTop: '0.1rem' }}>
                {proposedDepletionYear ? `${proposedDepletionYear}년` : '고갈 없음'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                (비관: {proposedDepletionYearPess ? `${proposedDepletionYearPess}년` : '없음'} | 낙관: {proposedDepletionYearOpt ? `${proposedDepletionYearOpt}년` : '없음'})
              </div>
            </div>
            <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>수지적자 전환시점 (이자제외)</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--warning)', marginTop: '0.15rem' }}>
                기존: {baseDeficitInfo.type === 'always-deficit' ? '시작부터 적자' : baseDeficitInfo.type === 'recovers-then-deficit' ? `${(baseDeficitInfo as { surplusYear: number }).surplusYear}년 흑자→${baseDeficitInfo.year ? `${baseDeficitInfo.year}년` : '적자없음'}` : baseDeficitYear ? `${baseDeficitYear}년` : '적자없음'}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary)', marginTop: '0.15rem' }}>
                제안: {proposedDeficitInfo.type === 'always-deficit' ? '시작부터 적자' : proposedDeficitInfo.type === 'recovers-then-deficit' ? `${(proposedDeficitInfo as { surplusYear: number }).surplusYear}년 흑자전환→${proposedDeficitInfo.year ? `${proposedDeficitInfo.year}년 재적자` : '유지'}` : proposedDeficitYear ? `${proposedDeficitYear}년` : '적자없음'}
              </div>
            </div>
            <div style={{ padding: '0.5rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>2065년 최종 적립률 (Funding Ratio)</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                기존: {baseProjection.length > 0 ? `${baseProjection[baseProjection.length - 1].fundingRatio}%` : '-%'}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--success)', marginTop: '0.15rem' }}>
                제안: {proposedProjection.length > 0 ? `${proposedProjection[proposedProjection.length - 1].fundingRatio}%` : '-%'}
              </div>
            </div>
            {baseDepletionYear && proposedDepletionYear && (
              <div style={{ padding: '0.5rem 1rem', background: 'var(--success-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid hsla(142, 70%, 45%, 0.3)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--success)' }}>
                  +{proposedDepletionYear - baseDepletionYear}년 연장
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Chart Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: '350px' }}>
          {mounted ? (
            <Line ref={assetChartRef} data={chartData} options={chartOptions} />
          ) : (
            <div style={{ textAlign: 'center', paddingTop: '6rem', color: 'var(--text-tertiary)' }}>차트 로딩 중...</div>
          )}
        </div>
      </section>

      {/* 1.5 MINISTERS COUNT COMPARISON CHART (TOP-MIDDLE WIDE) */}
      <section className="glass-panel animate-fade-in" style={{ width: '100%', minHeight: mode === 'chart-ministers' ? '80vh' : '400px', display: (mode === 'control' || (mode.startsWith('chart-') && mode !== 'chart-ministers')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>연도별 목회자(납입자/수급자) 수 추이 비교</h2>
            <p className="sub-title" style={{ fontSize: '0.85rem' }}>은퇴 연령 연장 및 가입 유입 정책에 따른 인원 수 추이 변화를 시각화합니다.</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Chart Split Button */}
            {!mode.startsWith('chart-') && (
              <button 
                onClick={() => window.open('/committee?mode=chart-ministers', 'ChartMinisters', 'width=1000,height=650,scrollbars=yes,resizable=yes')}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  background: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  borderRadius: '6px',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--primary-glow)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
              >
                🖥️ 차트 창 분리
              </button>
            )}

            {/* Reset Zoom Button */}
            <button 
              onClick={handleResetMinistersZoom}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#cbd5e1';
            }}
          >
            🔍 배율 초기화
          </button>
        </div>
      </div>

        {/* Chart Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: '300px' }}>
          {mounted ? (
            <Line ref={ministersChartRef} data={ministersChartData} options={ministersChartOptions} />
          ) : (
            <div style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--text-tertiary)' }}>차트 로딩 중...</div>
          )}
        </div>
      </section>

      {/* 1.6 TOTAL MINISTERS COUNT COMPARISON CHART (TOP-MIDDLE WIDE - UNRELATED TO PENSION) */}
      <section className="glass-panel animate-fade-in" style={{ width: '100%', minHeight: mode === 'chart-population' ? '80vh' : '400px', display: (mode === 'control' || (mode.startsWith('chart-') && mode !== 'chart-population')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>연도별 교단 목회자 인구 구성 추이 (연금 가입 무관)</h2>
            <p className="sub-title" style={{ fontSize: '0.85rem' }}>은퇴 연령 설정에 따라 교단 내 현직 활동 목회자 및 은퇴 목회자 수(총원)의 장기 변화를 시각화합니다.</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Chart Split Button */}
            {!mode.startsWith('chart-') && (
              <button 
                onClick={() => window.open('/committee?mode=chart-population', 'ChartPopulation', 'width=1000,height=650,scrollbars=yes,resizable=yes')}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  background: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  borderRadius: '6px',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--primary-glow)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
              >
                🖥️ 차트 창 분리
              </button>
            )}

            {/* Reset Zoom Button */}
            <button 
              onClick={handleResetTotalMinistersZoom}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#cbd5e1';
            }}
          >
            🔍 배율 초기화
          </button>
        </div>
      </div>

        {/* Chart Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: '300px' }}>
          {mounted ? (
            <Line ref={totalMinistersChartRef} data={totalMinistersChartData} options={totalMinistersChartOptions} />
          ) : (
            <div style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--text-tertiary)' }}>차트 로딩 중...</div>
          )}
        </div>
      </section>

      {/* 1.7 AGE DEMOGRAPHICS CHART - 연령대 분포 추이 */}
      <section className="glass-panel animate-fade-in" style={{ width: '100%', minHeight: mode === 'chart-agepyramid' ? '80vh' : '450px', display: (mode === 'control' || (mode.startsWith('chart-') && mode !== 'chart-agepyramid')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>📊 현직 목회자 연령대 분포 추이 (제안 vs 기존)</h2>
            <p className="sub-title" style={{ fontSize: '0.85rem' }}>은퇴 연령 연장 및 자원은퇴 비율에 따른 현직 목회자 연령대 구성과 중위 연령의 변화를 시각화합니다.</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!mode.startsWith('chart-') && (
              <button
                onClick={() => window.open('/committee?mode=chart-agepyramid', 'ChartAgePyramid', 'width=1000,height=650,scrollbars=yes,resizable=yes')}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  background: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  borderRadius: '6px',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--primary-glow)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
              >
                🖥️ 차트 창 분리
              </button>
            )}
            <button
              onClick={handleResetAgePyramidZoom}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                fontWeight: '600',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              🔍 배율 초기화
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {proposedProjection.length > 0 && (() => {
            const first = proposedProjection[0];
            const last = proposedProjection[proposedProjection.length - 1];
            const baseFirst = baseProjection[0];
            const baseLast = baseProjection[baseProjection.length - 1];
            return (
              <>
                <div style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center', flex: '1 1 120px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>2026 중위연령</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--warning)' }}>기존 {baseFirst?.medianAge || '-'}세</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>제안 {first.medianAge}세</div>
                </div>
                <div style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center', flex: '1 1 120px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>2065 중위연령</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--warning)' }}>기존 {baseLast?.medianAge || '-'}세</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>제안 {last.medianAge}세</div>
                </div>
                <div style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center', flex: '1 1 120px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>2026 60세 이상 비율</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--danger)' }}>
                    {baseFirst ? ((baseFirst.age60s + baseFirst.age70plus) / Math.max(1, baseFirst.ageUnder40 + baseFirst.age40s + baseFirst.age50s + baseFirst.age60s + baseFirst.age70plus) * 100).toFixed(1) : '-'}%
                  </div>
                </div>
                <div style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center', flex: '1 1 120px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>2065 60세 이상 비율 (제안)</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--danger)' }}>
                    {((last.age60s + last.age70plus) / Math.max(1, last.ageUnder40 + last.age40s + last.age50s + last.age60s + last.age70plus) * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', textAlign: 'center', flex: '1 1 120px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>중위연령 변화</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: last.medianAge > first.medianAge ? 'var(--danger)' : 'var(--success)' }}>
                    {last.medianAge > first.medianAge ? '+' : ''}{last.medianAge - first.medianAge}세
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Chart Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: '350px' }}>
          {mounted && proposedProjection.length > 0 ? (() => {
            const labels = proposedProjection.map((p) => `${p.year}년`);

            const getAgePyramidColor = (idx: number, opacityType: 'border' | 'background') => {
              const baseColors = [
                '34, 197, 94',     // under 40 - green
                '59, 130, 246',    // 40s - blue
                '245, 158, 11',    // 50s - amber
                '239, 68, 68',     // 60s - red
                '168, 85, 247',    // 70+ - purple
                '255, 255, 255',   // median proposed - white
                '148, 163, 184',   // median base - gray
              ];
              const defaultBgOpacities = [0.5, 0.5, 0.5, 0.5, 0.5, 0, 0];
              const defaultBorderOpacities = [0.8, 0.8, 0.8, 0.8, 0.8, 1.0, 0.7];

              const baseColor = baseColors[idx];
              if (highlightedAgePyramidIndices.length === 0) {
                return opacityType === 'background'
                  ? `rgba(${baseColor}, ${defaultBgOpacities[idx]})`
                  : `rgba(${baseColor}, ${defaultBorderOpacities[idx]})`;
              }
              if (highlightedAgePyramidIndices.includes(idx)) {
                return opacityType === 'background'
                  ? `rgba(${baseColor}, ${idx >= 5 ? 0 : 0.65})`
                  : `rgba(${baseColor}, 1)`;
              } else {
                return opacityType === 'background'
                  ? 'transparent'
                  : `rgba(${baseColor}, 0.1)`;
              }
            };

            const agePyramidData = {
              labels,
              datasets: [
                {
                  label: '40세 미만',
                  data: proposedProjection.map((p) => p.ageUnder40),
                  backgroundColor: getAgePyramidColor(0, 'background'),
                  borderColor: getAgePyramidColor(0, 'border'),
                  borderWidth: 1,
                  fill: true,
                  stack: 'proposed',
                  yAxisID: 'yCount',
                  order: 3,
                },
                {
                  label: '40대',
                  data: proposedProjection.map((p) => p.age40s),
                  backgroundColor: getAgePyramidColor(1, 'background'),
                  borderColor: getAgePyramidColor(1, 'border'),
                  borderWidth: 1,
                  fill: true,
                  stack: 'proposed',
                  yAxisID: 'yCount',
                  order: 3,
                },
                {
                  label: '50대',
                  data: proposedProjection.map((p) => p.age50s),
                  backgroundColor: getAgePyramidColor(2, 'background'),
                  borderColor: getAgePyramidColor(2, 'border'),
                  borderWidth: 1,
                  fill: true,
                  stack: 'proposed',
                  yAxisID: 'yCount',
                  order: 3,
                },
                {
                  label: '60대',
                  data: proposedProjection.map((p) => p.age60s),
                  backgroundColor: getAgePyramidColor(3, 'background'),
                  borderColor: getAgePyramidColor(3, 'border'),
                  borderWidth: 1,
                  fill: true,
                  stack: 'proposed',
                  yAxisID: 'yCount',
                  order: 3,
                },
                {
                  label: '70세 이상',
                  data: proposedProjection.map((p) => p.age70plus),
                  backgroundColor: getAgePyramidColor(4, 'background'),
                  borderColor: getAgePyramidColor(4, 'border'),
                  borderWidth: 1,
                  fill: true,
                  stack: 'proposed',
                  yAxisID: 'yCount',
                  order: 3,
                },
                {
                  label: '제안안 중위연령 (우축)',
                  data: proposedProjection.map((p) => p.medianAge),
                  borderColor: getAgePyramidColor(5, 'border'),
                  backgroundColor: 'transparent',
                  borderWidth: highlightedAgePyramidIndices.length === 0 ? 3 : (highlightedAgePyramidIndices.includes(5) ? 4 : 1),
                  borderDash: [],
                  pointRadius: 2,
                  pointHoverRadius: 5,
                  fill: false,
                  yAxisID: 'yAge',
                  order: 1,
                  tension: 0.2,
                },
                {
                  label: '기존안 중위연령 (우축)',
                  data: baseProjection.map((p) => p.medianAge),
                  borderColor: getAgePyramidColor(6, 'border'),
                  backgroundColor: 'transparent',
                  borderWidth: highlightedAgePyramidIndices.length === 0 ? 2 : (highlightedAgePyramidIndices.includes(6) ? 3 : 0.5),
                  borderDash: [8, 4],
                  pointRadius: 0,
                  fill: false,
                  yAxisID: 'yAge',
                  order: 1,
                  tension: 0.2,
                },
              ],
            };

            const agePyramidOptions = {
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index' as const, intersect: false },
              plugins: {
                legend: {
                  position: 'top' as const,
                  labels: { color: '#94a3b8', font: { size: 11 }, usePointStyle: true },
                  onClick: (_e: unknown, legendItem: { datasetIndex?: number }) => {
                    const idx = legendItem.datasetIndex;
                    if (idx === undefined) return;
                    setHighlightedAgePyramidIndices((prev) =>
                      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                    );
                  },
                },
                tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  titleColor: '#e2e8f0',
                  bodyColor: '#cbd5e1',
                  borderColor: 'var(--border-color)',
                  borderWidth: 1,
                  callbacks: {
                    label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
                      const val = ctx.parsed.y;
                      if (val === null || val === undefined) return '';
                      const label = ctx.dataset.label || '';
                      if (label.includes('중위연령')) return `${label}: ${val}세`;
                      return `${label}: ${val.toLocaleString()}명`;
                    },
                  },
                },
                zoom: {
                  pan: { enabled: true, mode: 'x' as const },
                  zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' as const },
                },
              },
              scales: {
                x: {
                  ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 20 },
                  grid: { color: 'rgba(148, 163, 184, 0.06)' },
                },
                yCount: {
                  type: 'linear' as const,
                  position: 'left' as const,
                  stacked: true,
                  title: { display: true, text: '인원 (명)', color: '#94a3b8', font: { size: 11 } },
                  ticks: { color: '#64748b', font: { size: 10 }, callback: (value: string | number) => `${Number(value).toLocaleString()}명` },
                  grid: { color: 'rgba(148, 163, 184, 0.08)' },
                  min: 0,
                },
                yAge: {
                  type: 'linear' as const,
                  position: 'right' as const,
                  title: { display: true, text: '중위 연령 (세)', color: '#94a3b8', font: { size: 11 } },
                  ticks: { color: '#64748b', font: { size: 10 }, callback: (value: string | number) => `${value}세` },
                  grid: { drawOnChartArea: false },
                  min: 30,
                  max: 80,
                },
              },
            };

            return <Line ref={agePyramidChartRef} data={agePyramidData as Parameters<typeof Line>[0]['data']} options={agePyramidOptions as Parameters<typeof Line>[0]['options']} />;
          })() : (
            <div style={{ textAlign: 'center', paddingTop: '5rem', color: 'var(--text-tertiary)' }}>차트 로딩 중...</div>
          )}
        </div>
      </section>

      {/* 1.8 SHORT TERM (10 YEARS) FINANCIAL PROJECTION CHART (MIDDLE WIDE) */}
      <section className="glass-panel animate-fade-in" style={{ width: '100%', minHeight: mode === 'chart-shortterm' ? '80vh' : '450px', display: (mode === 'control' || (mode.startsWith('chart-') && mode !== 'chart-shortterm')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>📊 실제 DB 기반 10개년 단기 재정 전망 (제안 정책 기준)</h2>
            <p className="sub-title" style={{ fontSize: '0.85rem' }}>향후 10년(2026~2035년) 동안의 기금 잔액(선), 총 수입 및 지출(막대)과 은퇴 수급자 수(우측 Y축 선)를 시각화합니다.</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Chart Split Button */}
            {!mode.startsWith('chart-') && (
              <button 
                onClick={() => window.open('/committee?mode=chart-shortterm', 'ChartShortTerm', 'width=1000,height=650,scrollbars=yes,resizable=yes')}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  background: 'var(--primary-glow)',
                  border: '1px solid var(--primary)',
                  borderRadius: '6px',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--primary-glow)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
              >
                🖥️ 차트 창 분리
              </button>
            )}

            {/* Reset Zoom Button */}
            <button 
              onClick={handleResetShortTermZoom}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#cbd5e1';
            }}
          >
            🔍 배율 초기화
          </button>
        </div>
      </div>

        {/* Chart Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: '350px' }}>
          {mounted ? (
            <Chart ref={shortTermChartRef} type="bar" data={shortTermChartData} options={shortTermChartOptions} />
          ) : (
            <div style={{ textAlign: 'center', paddingTop: '6rem', color: 'var(--text-tertiary)' }}>차트 로딩 중...</div>
          )}
        </div>
      </section>

      {/* 2. SPLIT LAYOUT (BOTTOM) */}
      <div className="dashboard-grid" style={{ display: (mode === 'control' || mode === 'viewer' || mode.startsWith('chart-')) ? 'block' : 'grid', marginTop: '0' }}>
        {/* Bottom Left: Interactive Controls */}
        {renderSimulatorControls(false)}

        {/* 엑셀 시뮬레이션 전제 조건 및 기초 변수표 */}
        <section className="glass-panel" style={{ display: (mode === 'viewer' || mode.startsWith('chart-')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0', gridColumn: 'span 1' }}>
          <h2 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            📋 엑셀 시뮬레이션 전제 조건 및 기초 변수
          </h2>
          <p className="sub-title" style={{ fontSize: '0.8rem', margin: 0 }}>
            교단 연금수지 엑셀 모델(2022년 개정안/25년 반영) 상의 전제 조건과 감액 스케줄 상수입니다.
          </p>
          
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>구분</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>항목명</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>기준값 (엑셀)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td rowSpan={5} style={{ padding: '0.5rem', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.02)', verticalAlign: 'middle' }}>기초 매개변수</td>
                  <td style={{ padding: '0.5rem' }}>평균 완납율</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>83.0%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem' }}>자연 감소율 (매년)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>2.0%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem' }}>연평균 신규가입 유입</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>40명</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem' }}>적립율 (20년 이내 / 초과)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>연 3.0% / 연 2.0%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem' }}>기준보수 및 평균지급액</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>145만 원 / 743,045원 (51.24%)</td>
                </tr>

                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td rowSpan={2} style={{ padding: '0.5rem', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.02)', verticalAlign: 'middle' }}>조기은퇴 감액<br/>(정년 70세 대비)</td>
                  <td style={{ padding: '0.5rem' }}>연 3.0% 감액 스케줄</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.725rem', lineHeight: '1.4' }}>
                    69세(97%) | 68세(94%) | 67세(91%)<br/>
                    66세(88%) | 65세(85%)
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem' }}>연 2.0% 감액 스케줄</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.725rem', lineHeight: '1.4' }}>
                    69세(98%) | 68세(96%) | 67세(94%)<br/>
                    66세(92%) | 65세(90%)
                  </td>
                </tr>

                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.02)' }}>장기수급 감액</td>
                  <td style={{ padding: '0.5rem' }}>11년차 이상 / 16년차 이상</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: 'var(--warning)' }}>
                    90% 지급 (-10%p) / 85% 지급 (-15%p)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 교단 목회자 연금 가입 및 수급 자격 현황 표 */}
        {enrollmentStats && (
          <section className="glass-panel" style={{ display: (mode === 'viewer' || mode.startsWith('chart-')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0', gridColumn: 'span 1' }}>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🔍 교단 목회자 연금 가입 및 수급 자격 현황 (15년 납입 기준)
            </h2>
            <p className="sub-title" style={{ fontSize: '0.8rem', margin: 0 }}>
              현직 시무 목회자 중 연금 납입 여부 및 은퇴 시점(70세)의 15년(180개월) 이상 납입 가능 여부 분석 수치입니다.
            </p>
            
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>구분</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>상세 항목</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>목회자 수</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>비율 (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 전체 시무 목회자 */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)', fontWeight: '700' }}>
                    <td colSpan={2} style={{ padding: '0.5rem' }}>전체 시무 중인 목회자 (삭제/사망/은퇴 제외)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{enrollmentStats.totalActiveMinisters.toLocaleString()} 명</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>100.0%</td>
                  </tr>

                  {/* 연금 가입자 */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td rowSpan={2} style={{ padding: '0.5rem', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.02)', verticalAlign: 'middle' }}>
                      연금 가입자 ({enrollmentStats.enrolled.toLocaleString()}명)
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--success)' }}>70세 은퇴 시 15년(180개월) 이상 납입 가능자 (수급 자격 확보)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>
                      {enrollmentStats.enrolledEligible.toLocaleString()} 명
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {((enrollmentStats.enrolledEligible / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--danger)' }}>15년 납입 미달로 수급 불가 (56세 이상 등 늦게 가입한 목회자)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--danger)' }}>
                      {enrollmentStats.enrolledIneligible.toLocaleString()} 명
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {((enrollmentStats.enrolledIneligible / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%
                    </td>
                  </tr>

                  {/* 연금 미가입자 */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td rowSpan={3} style={{ padding: '0.5rem', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.02)', verticalAlign: 'middle' }}>
                      연금 미가입자 ({enrollmentStats.nonEnrolled.toLocaleString()}명)
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--primary)' }}>만 55세 이하 (신규 가입 시 15년 납입 조건 충족 가능군)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                      {enrollmentStats.nonEnrolledEligible.toLocaleString()} 명
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {((enrollmentStats.nonEnrolledEligible / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>만 56세 이상 (가입해도 70세 정년 시 15년 미달군)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {enrollmentStats.nonEnrolledIneligible.toLocaleString()} 명
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {((enrollmentStats.nonEnrolledIneligible / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>생년월일 미기재로 식별 불가능한 미가입자</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {enrollmentStats.nonEnrolledNoBirthday.toLocaleString()} 명
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {((enrollmentStats.nonEnrolledNoBirthday / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-tertiary)', lineHeight: '1.4', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              💡 <strong>가입 잠재군 반영</strong>: 연금 미가입자 중 55세 이하인 목회자({enrollmentStats.nonEnrolledEligible.toLocaleString()}명)는 매년 <strong>"정책 시뮬레이션 설정"</strong>의 <strong>"신규 가입 유치 수"</strong> 슬라이더 목표값에 맞춰 연금에 신규 가입(납입 시작)을 하도록 시뮬레이션 엔진에 연동되었습니다.
            </div>
          </section>
        )}

        {/* 연령대별 연금 가입 및 미가입 현황 표 */}
        {enrollmentStats && (
          <section className="glass-panel" style={{ display: (mode === 'viewer' || mode.startsWith('chart-')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem', gridColumn: 'span 1' }}>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              📊 연령대별 연금 가입 및 미가입 현황
            </h2>
            <p className="sub-title" style={{ fontSize: '0.8rem', margin: 0 }}>
              연금 가입 목회자(1회 이상 납부자)와 미가입 목회자의 연령대별 상세 분포입니다.
            </p>
            
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>연령대</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--success)' }}>가입자 수 (비율)</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--primary)' }}>미가입자 수 (비율)</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>합계 인원 (비율)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 30대 이하 */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '600' }}>30대 이하 (만 39세 이하)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--success)' }}>
                      {enrollmentStats.ageGroups.under40.enrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.under40.enrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--primary)' }}>
                      {enrollmentStats.ageGroups.under40.nonEnrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.under40.nonEnrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>
                      {(enrollmentStats.ageGroups.under40.enrolled + enrollmentStats.ageGroups.under40.nonEnrolled).toLocaleString()} 명 ({(((enrollmentStats.ageGroups.under40.enrolled + enrollmentStats.ageGroups.under40.nonEnrolled) / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  {/* 40대 */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '600' }}>40대 (만 40세 ~ 49세)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--success)' }}>
                      {enrollmentStats.ageGroups.ages40s.enrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.ages40s.enrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--primary)' }}>
                      {enrollmentStats.ageGroups.ages40s.nonEnrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.ages40s.nonEnrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>
                      {(enrollmentStats.ageGroups.ages40s.enrolled + enrollmentStats.ageGroups.ages40s.nonEnrolled).toLocaleString()} 명 ({(((enrollmentStats.ageGroups.ages40s.enrolled + enrollmentStats.ageGroups.ages40s.nonEnrolled) / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  {/* 50대 */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '600' }}>50대 (만 50세 ~ 59세)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--success)' }}>
                      {enrollmentStats.ageGroups.ages50s.enrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.ages50s.enrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--primary)' }}>
                      {enrollmentStats.ageGroups.ages50s.nonEnrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.ages50s.nonEnrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>
                      {(enrollmentStats.ageGroups.ages50s.enrolled + enrollmentStats.ageGroups.ages50s.nonEnrolled).toLocaleString()} 명 ({(((enrollmentStats.ageGroups.ages50s.enrolled + enrollmentStats.ageGroups.ages50s.nonEnrolled) / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  {/* 60대 이상 */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '600' }}>60대 이상 (만 60세 이상)</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--success)' }}>
                      {enrollmentStats.ageGroups.over60.enrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.over60.enrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--primary)' }}>
                      {enrollmentStats.ageGroups.over60.nonEnrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.over60.nonEnrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>
                      {(enrollmentStats.ageGroups.over60.enrolled + enrollmentStats.ageGroups.over60.nonEnrolled).toLocaleString()} 명 ({(((enrollmentStats.ageGroups.over60.enrolled + enrollmentStats.ageGroups.over60.nonEnrolled) / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  {/* 미파악/불량 */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
                    <td style={{ padding: '0.5rem' }}>생년월일 미기재</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {enrollmentStats.ageGroups.unknown.enrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.unknown.enrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {enrollmentStats.ageGroups.unknown.nonEnrolled.toLocaleString()} 명 ({((enrollmentStats.ageGroups.unknown.nonEnrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>
                      {(enrollmentStats.ageGroups.unknown.enrolled + enrollmentStats.ageGroups.unknown.nonEnrolled).toLocaleString()} 명 ({(((enrollmentStats.ageGroups.unknown.enrolled + enrollmentStats.ageGroups.unknown.nonEnrolled) / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                  </tr>
                  {/* 합계 */}
                  <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '700' }}>
                    <td style={{ padding: '0.5rem' }}>합계</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--success)' }}>
                      {enrollmentStats.enrolled.toLocaleString()} 명 ({((enrollmentStats.enrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--primary)' }}>
                      {enrollmentStats.nonEnrolled.toLocaleString()} 명 ({((enrollmentStats.nonEnrolled / enrollmentStats.totalActiveMinisters) * 100).toFixed(1)}%)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {enrollmentStats.totalActiveMinisters.toLocaleString()} 명 (100.0%)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}


        {/* Bottom Right: Projection Comparison Table */}
        <section className="glass-panel" style={{ display: (mode === 'control' || mode.startsWith('chart-')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem', gridColumn: (mode === 'viewer' || mode.startsWith('chart-')) ? 'span 2' : 'span 1' }}>
          <h2 style={{ fontSize: '1.25rem' }}>연도별 재정 흐름 세부 프로젝션 (제안 정책 기준)</h2>
          <p className="sub-title" style={{ fontSize: '0.85rem' }}>완납율(83%) 및 자연감소(2%) 하의 세부 수입 구성과 지출 추이입니다.</p>

          <div className="table-container" style={{ maxHeight: '880px', overflowY: 'auto', flex: 1 }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>

              <thead>
                <tr>
                  <th rowSpan={2} style={{ verticalAlign: 'middle', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem' }}>예측 연도</th>
                  <th rowSpan={2} style={{ verticalAlign: 'middle', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem', fontSize: '0.85rem' }}>인원 (납입/수급)</th>
                  <th colSpan={4} style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--success)', padding: '0.5rem' }}>세부 수입 (Inflow)</th>
                  <th rowSpan={2} style={{ verticalAlign: 'middle', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem' }}>지출 (Outflow)</th>
                  <th rowSpan={2} style={{ verticalAlign: 'middle', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem' }}>연말 잔액</th>
                </tr>
                <tr>
                  <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.4rem', fontSize: '0.75rem' }}>일반 납입</th>
                  <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.4rem', fontSize: '0.75rem' }}>가입자 증가</th>
                  <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.4rem', fontSize: '0.75rem' }}>은퇴 연장</th>
                  <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.4rem', fontSize: '0.75rem' }}>운용 수익</th>
                </tr>
              </thead>
              <tbody>
                {proposedProjection.map((p) => {
                  return (
                    <tr key={p.year} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ fontWeight: '600', textAlign: 'center', padding: '0.4rem' }}>{p.year}년</td>
                      <td style={{ textAlign: 'center', padding: '0.4rem', fontSize: '0.8rem' }}>{p.activeMembers}명 / {p.payoutMembers}명</td>
                      <td style={{ textAlign: 'right', padding: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        +{(p.inflowNormal / 100000000).toFixed(1)}억
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.4rem', color: 'var(--primary)', fontSize: '0.8rem' }}>
                        +{(p.inflowNew / 100000000).toFixed(1)}억
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.4rem', color: 'var(--success)', fontWeight: '600', fontSize: '0.8rem' }}>
                        +{(p.inflowExtension / 100000000).toFixed(1)}억
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.4rem', color: 'hsl(142, 70%, 45%)', fontSize: '0.8rem' }}>
                        +{(p.inflowInterest / 100000000).toFixed(1)}억
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.4rem', color: 'var(--danger)', fontSize: '0.8rem' }}>
                        -{(p.outflow / 100000000).toFixed(1)}억
                      </td>
                      <td style={{ fontWeight: '700', textAlign: 'right', padding: '0.4rem', color: p.endingAsset < 0 ? 'var(--danger)' : 'var(--text-primary)', fontSize: '0.85rem' }}>
                        {(p.endingAsset / 100000000).toFixed(1)}억 원
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 은퇴 수급 가입자 실제 은퇴 나이 분포 표 */}
        <section className="glass-panel" style={{ display: (mode === 'control' || mode.startsWith('chart-')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0', gridColumn: (mode === 'viewer' || mode.startsWith('chart-')) ? 'span 2' : 'span 1' }}>
          <h2 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            📊 은퇴 수급자 실제 은퇴 나이 분포 (DB 1,018명)
          </h2>
          <p className="sub-title" style={{ fontSize: '0.8rem', margin: 0 }}>
            실제 연금 DB에 등록된 전체 은퇴자 중 연령 식별이 가능한 1,018명의 은퇴 당시 나이 분석 통계입니다.
          </p>
          
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>은퇴 구분 (연령대)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>인원 수</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>비율 (%)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: '600' }}>만 65세 은퇴 (자원은퇴 초입)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>113 명</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>11.1%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: '600' }}>만 66세 ~ 69세 은퇴 (자원은퇴)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>329 명</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>32.3%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: '600' }}>만 70세 ~ 71세 은퇴 (정년 및 유예)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--warning)' }}>363 명</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--warning)' }}>35.7%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>기타 조기 은퇴 (50세 ~ 64세)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>181 명</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>17.8%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>기타 만기 은퇴 (72세 ~ 78세)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>32 명</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>3.1%</td>
                </tr>
                <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '0.5rem' }}>합계 (연령 식별 가능 은퇴자)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>1,018 명</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>100.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style={{ fontSize: '0.725rem', color: 'var(--text-tertiary)', lineHeight: '1.4', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div>📌 <strong>자원은퇴 현황 (만 65세 ~ 69세)</strong>: 전체 은퇴자의 <strong>43.4% (442명)</strong>가 정년(70세)에 도달하기 전 자발적으로 수급을 개시했습니다.</div>
            <div>📌 <strong>정년은퇴 현황 (만 70세 ~ 71세)</strong>: 전체 은퇴자의 <strong>35.7% (363명)</strong>로 단일 연령대 중 가장 높은 비중을 차지합니다.</div>
          </div>
        </section>
      </div>

      {/* 3. WIDE LAYOUT (BOTTOM FULL) - 목회자 수 추이 비교 표 */}
      <section className="glass-panel animate-fade-in" style={{ display: (mode === 'control' || mode.startsWith('chart-')) ? 'none' : 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>기존 안 vs 제안 안 목회자(납입자/수급자) 수 추이 비교</h2>
            <p className="sub-title" style={{ fontSize: '0.85rem' }}>은퇴 연령 및 신규 유입 정책 변경에 따른 연도별 납입자 및 수급자 수의 상세 변화를 비교합니다.</p>
          </div>
        </div>

        <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ verticalAlign: 'middle', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.75rem' }}>예측 연도</th>
                <th colSpan={2} style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '0.75rem' }}>기존 정책 안 (65/70세, 신규 40명)</th>
                <th colSpan={2} style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--primary)', padding: '0.75rem' }}>제안 정책 안 (조정 시나리오)</th>
                <th colSpan={2} style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--warning)', padding: '0.75rem' }}>정책 전환 효과 (차이)</th>
              </tr>
              <tr>
                <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem' }}>납입 가입자</th>
                <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem' }}>연금 수급자</th>
                <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem' }}>납입 가입자</th>
                <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem' }}>연금 수급자</th>
                <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem' }}>납입자 증감</th>
                <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', padding: '0.5rem' }}>수급자 증감</th>
              </tr>
            </thead>
            <tbody>
              {baseProjection.map((baseP, idx) => {
                const proposedP = proposedProjection[idx] || { activeMembers: 0, payoutMembers: 0 };
                const activeDiff = proposedP.activeMembers - baseP.activeMembers;
                const payoutDiff = proposedP.payoutMembers - baseP.payoutMembers;

                return (
                  <tr key={baseP.year} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ fontWeight: '600', textAlign: 'center', padding: '0.5rem' }}>{baseP.year}년</td>
                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>{baseP.activeMembers.toLocaleString()} 명</td>
                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>{baseP.payoutMembers.toLocaleString()} 명</td>
                    <td style={{ color: 'var(--primary)', fontWeight: '600', textAlign: 'center', padding: '0.5rem' }}>{proposedP.activeMembers.toLocaleString()} 명</td>
                    <td style={{ color: 'var(--warning)', fontWeight: '600', textAlign: 'center', padding: '0.5rem' }}>{proposedP.payoutMembers.toLocaleString()} 명</td>
                    <td style={{ 
                      fontWeight: '700', 
                      textAlign: 'center',
                      padding: '0.5rem',
                      color: activeDiff > 0 ? 'var(--success)' : activeDiff < 0 ? 'var(--danger)' : 'var(--text-secondary)' 
                    }}>
                      {activeDiff > 0 ? `+${activeDiff}` : activeDiff} 명
                    </td>
                    <td style={{ 
                      fontWeight: '700', 
                      textAlign: 'center',
                      padding: '0.5rem',
                      color: payoutDiff < 0 ? 'var(--success)' : payoutDiff > 0 ? 'var(--danger)' : 'var(--text-secondary)' 
                    }}>
                      {payoutDiff > 0 ? `+${payoutDiff}` : payoutDiff} 명
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 🖥️ 사이드 드로워 시뮬레이터 조절 패널 */}
      {isDrawerOpen && (
        <>
          {/* Backdrop 오버레이 */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              transition: 'opacity 0.3s ease'
            }}
          />
          {/* 드로워 패널 */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '460px',
              maxWidth: '90%',
              height: '100vh',
              backgroundColor: 'var(--bg-primary, #0f172a)',
              backgroundImage: 'linear-gradient(to bottom, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
              boxShadow: '-4px 0 25px rgba(0, 0, 0, 0.5)',
              borderLeft: '1px solid var(--border-color)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* 드로워 헤더 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(255, 255, 255, 0.03)'
            }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎛️ 시뮬레이터 설정 바
              </h2>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.2rem 0.5rem',
                  lineHeight: '1',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                &times;
              </button>
            </div>
            {/* 드로워 본문 (설정 슬라이더들) */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {renderSimulatorControls(true)}
            </div>
          </div>

          {/* slideIn Keyframe 스타일 주입 */}
          <style jsx global>{`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
