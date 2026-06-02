'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { marked } from 'marked';

// 기장 총회 연금 수지 시뮬레이션 상세 수리 논문 및 종합 해설서 전문
const MARKDOWN_CONTENT = `# 교단 연금 기금의 지속가능성 분석을 위한 계리적 수리 모델 연구 및 대책위용 종합 해설서
### (An Actuarial Mathematical Model, Dynamic Demographic Simulation, and Practical Policy Guide for Denominational Pension Funds)

---

## 요약 (Abstract)
본 연구는 저출생으로 인한 신규 목회자 유입 급감, 기대수명 증가에 따른 연금 지급 기간 장기화, 미자립 교회의 완납율 저하라는 삼중고에 처한 **교단 연금 기금의 장기 재정 건전성을 진단하고 정책 대안을 모의하기 위해 개발된 계리 시뮬레이션 수리 모델 및 종합 해설**을 제시한다. 실제 교단 가입자 데이터베이스를 연동하고, 생년월일 누락 데이터 정합성을 확보하는 통계적 보정을 거쳤으며, 개별 목회자의 납입·수령 생애 주기를 마이크로 시뮬레이션(Micro-simulation) 형태로 추적한다. 

나아가 할인율 기반의 계리 부채(Actuarial Liability)와 적립률(Funding Ratio), 그리고 수지 적자 전환 연도를 도출하는 계리적 수리 모형을 수학적으로 정식화하고, 시뮬레이터에 적용된 알고리즘을 상세한 예시와 일상적인 비유를 통해 해설함으로써 대책위원회의 의사결정을 실질적으로 지원하고자 한다.

---

## 1. 서론 (Introduction) - 왜 현금 흐름뿐만 아니라 '계리적 평가'가 필요한가?

공적 연금이나 교단 연금 같은 기금형 연금 제도의 재정을 평가할 때, 흔히 저지르는 실수는 **"올해 들어온 돈(수입)이 나간 돈(지출)보다 많으니 안전하다"**고 낙관하는 것입니다. 그러나 연금은 가입자가 수십 년간 보험료를 내고, 은퇴 후 사망할 때까지 수십 년간 연금을 받는 초장기 약속입니다. 

따라서 단순히 매년의 현금 수지를 추정하는 것을 넘어, **"현재 가입되어 있는 모든 목회자에게 미래에 확정적으로 지급해야 할 연금의 총액이 오늘 기준으로 얼마인가?"**를 평가하는 **계리적 부채 평가(Actuarial Valuation)**가 반드시 수행되어야 합니다.

본 해설서는 교단 연금 시뮬레이터에 탑재된 복잡한 계리 공식과 인구 시뮬레이션의 수학적 원리를 알기 쉽게 설명하고, 실제 가상의 목회자 사례를 통해 은퇴 나이와 연차에 따라 연금액이 어떻게 변하는지 구체적으로 보여줍니다. 이를 통해 대책위원회 위원들과 교단 관계자들이 연금 개혁안의 타당성을 객관적이고 과학적인 근거에 기반하여 논의할 수 있도록 돕고자 합니다.

---

## 2. 기초 데이터 분석 및 통계적 보정 (Baseline Data & Preprocessing)

실제 데이터베이스(DB)를 기반으로 시뮬레이션을 수행할 때 가장 먼저 부딪히는 장벽은 **"누락되거나 오염된 행정 데이터"**입니다. 시뮬레이터는 이를 수학적·통계적 기법으로 정교하게 보정합니다.

### 2.1 가입자 판정 및 예외 처리 필터 (미납자 복원)
가입 데이터는 존재하지만 과거 납입 금액이나 최신 납입 금액이 모두 \`0원\`으로 등록된 미납 가입자(active 상태이나 납입 이력이 전무한 자)의 경우, 시뮬레이션의 과소 평가를 방지하기 위해 엑셀 표준 폴백(Fallback) 값을 주입하여 가입 상태를 정상 복원합니다.

*   **가입자 판정 기준**: 가입자 고유번호 $PenNo \\ne \\emptyset$ 이며, 누적 납입 개월 수 $PastMonths > 0$ 또는 현재까지의 적립 자산 $CurrentAmt > 0$인 대상자를 실제 가입 상태로 판정합니다.
*   **0원 미납자 구제 공식**: 
    $$FallbackMonthlyContribute(\\text{본인}) = 142,000\\,\\text{원}$$
    $$FallbackMonthlyShare(\\text{교회}) = 228,000\\,\\text{원}$$
    $$FallbackMonthlyPay(\\text{합계}) = 370,000\\,\\text{원}$$

---

### 2.2 생년월일 데이터 누락에 대한 분산 보정 (Imputation) 알고리즘

> [!IMPORTANT]
> **쉽게 이해하기: 2046년에 찾아올 뻔한 "동시 은퇴 절벽" 막기**
> 과거 데이터 입력 누락으로 인해 생년월일이 비어 있는 가입자들을 단순히 특정 연도(예: 1965년)로 일괄 대입하면 어떻게 될까요? 시뮬레이션 상에서 **2046년이 되는 해에 갑자기 수백 명의 목회자가 동시에 은퇴하고 동시에 사망하는 기이한 현상**이 발생합니다. 이는 그래프상에서 재정이 갑자기 낭떠러지로 떨어지는 극심한 통계적 왜곡을 초래합니다.

이를 해결하기 위해 시뮬레이터는 가입자 고유 번호의 인덱스($idx$)를 기반으로 생년월일 미기재자를 1955년부터 1985년 사이로 고르게 흩뿌려 분산 할당하는 **해시 분산 보정 공식**을 적용합니다.
$$BirthYear = 1955 + (idx \\pmod{31})$$
이 처리를 통해 매년 은퇴하고 사망하는 목회자의 분포 곡선이 계단형 절벽이 아닌, 실제 현실과 일치하는 완만하고 매끄러운 형태를 띠게 됩니다.

---

## 3. 인구 통계학적 동적 시뮬레이션 모델 (Demographic Simulation Model)

시뮬레이션은 2026년부터 2065년까지 총 $T = 40$년간 개별 목회자의 가입, 납입, 은퇴, 사망, 배우자 승계에 이르는 생애 주기를 마이크로 시뮬레이션(Micro-simulation) 형태로 추적합니다.

### 3.1 동적 기대수명 및 고령화 속도 연계
의료 기술 발달로 인해 인류의 수명은 계속 늘어납니다. 시뮬레이션 내부에서는 고령화 속도를 반영하여 경과 시간 $t$에 따라 가입자의 기대수명이 점진적으로 늘어나는 동적 공식을 사용합니다.
$$LifeExpectancy_{y} = LE_{base} + \\frac{y - 2026}{10} \\times \\lambda_{longevity}$$
*   $LE_{base}$: 기준 남성 평균 수명 (81세) 및 여성 평균 수명 (87세)
*   $\\lambda_{longevity}$: 10년당 기대수명 상승 속도 (기본값: $0.15$세/10년)
*   개별 사망 시점 $DeathYear$: $BirthYear + LifeExpectancy_y$

---

### 3.2 신규 가입자 유입량 및 저출생 감소율
저출생으로 인한 교단 내 목회자 후보생(신학생 등)의 감소 추세를 지수 감소 모형으로 탑재했습니다.
$$NewSubs_{y} = \\text{round} \\left( NewSubs_{base} \\times (1 - \\delta_{decline})^{y - 2026} \\right)$$
*   $NewSubs_{base}$: 초기 설정 신규 가입 수 (기본값 40명)
*   $\\delta_{decline}$: 신규 가입자 연 감소율 (기본값 $1.5\\%$)

> [!TIP]
> **미가입자 대기 Pool 우선 매칭 메커니즘**
> 매년 새로 유입되는 인원은 완전히 가상의 인물을 무작정 만들기 전에, **현재 교단에 시무 중이지만 연금에 가입하지 않은 만 55세 이하의 대기 인원(436명)**에서 우선 차감하여 강제 가입시킵니다. 이 대기 풀이 완전히 바닥난 경우에만 만 30세의 가상 가입자를 새로 생성합니다. 이는 교단 내부의 실제 미가입자 포섭 정책을 충실히 모의합니다.

---

### 3.3 은퇴 연령의 확률적 분포 모델 (실태 데이터 반영)
과거 단일 정년 은퇴(예: 모두 만 70세에 칼같이 은퇴) 가정은 비현실적입니다. 실제 교단 은퇴 수급자 1,018명의 은퇴 당시 연령 실태 데이터를 분석하여 아래와 같이 확률 분포 버킷으로 개별 목회자의 은퇴 연령($RA$)을 결정합니다.

*   **실제 은퇴 실태 분포**:
    - **자원은퇴 초입 (만 65세 은퇴)**: 전체의 약 **11.1%** ($idx \\pmod{1000} < 111$)
    - **조기/자원은퇴 (만 66세 ~ 69세)**: 전체의 약 **32.3%** ($111 \\le idx \\pmod{1000} < 434$)
    - **정년 및 유예은퇴 (만 70세 ~ 71세)**: 전체의 약 **35.7%** ($434 \\le idx \\pmod{1000} < 791$)
    - **기타 조기 은퇴 (만 50세 ~ 64세)**: 전체의 약 **17.8%** ($791 \\le idx \\pmod{1000} < 969$)
    - **기타 만기 은퇴 (만 72세 ~ 78세)**: 전체의 약 **3.1%** ($969 \\le idx \\pmod{1000} \\le 999$)

이를 수학적 버킷 분산 알고리즘으로 구현하여 개별 가입자마다 고유한 은퇴 나이를 동적으로 할당하되, 대책위가 제안한 은퇴 연령($VoluntaryAge$, $MandatoryAge$) 슬라이더의 증감폭과 연동되도록 하였습니다.

---

## 4. 수치 및 재정수지 산출 모형 (Financial Projection Model)

매년 말 기금의 총 자산 $A_y$는 전년도 자산에 운용 수익과 기여금 수입을 더하고, 연금 급여 지출을 차감하여 누적됩니다.
$$A_y = A_{y-1} + I_y + CF_{in, y} - CF_{out, y}$$
$$I_y = \\max \\left( 0, \\, \\text{round}(A_{y-1} \\times r_{interest}) \\right)$$
*   $r_{interest}$: 재단 기금 운용 수익률 (%)

### 4.1 완납율 및 기여금 수입 ($CF_{in, y}$) 산정
납입 기여금은 목회자 본인이 납부하는 보험료와 소속 교회의 매칭 부담금으로 구성되며, 미자립 교회의 재정 상황에 영향을 받습니다.

#### 4.1.1 미자립 교회 재정보조율 연동 완납율 보정
자립 교회의 완납율을 $C_{self} = 90\\%$로 두고, 미자립 교회의 기초 완납율을 $C_{non, base} = 67\\%$로 정의합니다. 총회가 미자립 교회의 매칭 부담금을 대납 지원하는 **재정보조율 $\\theta_{subsidy}$**가 올라가면, 미자립 교회의 완납율 $C_{non}$은 다음과 같이 자립 교회 수준(90%)까지 보조율에 비례하여 선형적으로 상승합니다.
$$C_{non} = C_{non, base} + (C_{self} - C_{non, base}) \\times \\frac{\\theta_{subsidy}}{100}$$

전체 가입자 중 미자립 교회의 비중을 $\\phi_{non}$ (기본값: $30\\%$)이라 할 때, 최종 혼합 완납율 $C_{blend}$는 다음과 같습니다.
$$C_{blend} = C_{self} \\times (1 - \\phi_{non}) + C_{non} \\times \\phi_{non}$$

#### 4.1.2 기여율 인상 반영 유입액 공식
개별 가입자 $j$에 대해 납입 기간일 경우, 기준 보험료율 $9\\%$ 대비 설정 보험료율 $R_{contrib}$의 배율을 곱하고 개인별 완납율을 반영하여 수입을 계산합니다.
$$CF_{in, y} = \\sum_{j \\in Active} \\left[ (Contribute_j + Share_j) \\times (1 + g_{wage})^{y - 2026} \\times \\frac{R_{contrib}}{9.0} \\times C_j \\times 12 \\right]$$
*   $g_{wage}$: 연평균 임금상승률 (%)
*   $C_j$: 가입자의 완납율 (미자립 교회 소속이면 $C_{non}$, 자립 교회 소속이면 $C_{self}$)

---

### 4.2 연금 급여 지출 ($CF_{out, y}$) 및 정책 감액 공식
가입자가 연금을 정상 수령하려면 **최소 납입 기간 조건인 180개월(15년)을 충족**해야 합니다. 은퇴 시점에 180개월 미만인 가입자는 납부한 원금 환급 등의 예외 처리를 거쳐 연금 수급 풀에서 제외됩니다.

#### 4.2.1 일시금 중도 인출 모델 (Lump-sum Leakage)
은퇴 시점에 도달한 목회자 중 일시금 수령 퇴출 비율 $\\beta_{lump}$ (기본값: $5\\%$)에 해당하는 인원은 매월 받는 연금 대신 일시금(평균 8,000만 원에 임금상승률 반영)을 일시에 인출하고 기금 수급 풀에서 탈퇴합니다. 이 현상은 기금에 일시적인 대규모 유동성 유출(Leakage) 부담을 줍니다.
$$LumpSumAmount = 80,000,000 \\times (1 + g_{wage})^{RA_j - 2026}$$

#### 4.2.2 연금 지급결정율 계산
은퇴 시점의 납입 기간(Months)에 따라 지급 비율이 결정됩니다.
*   **신규 가입자**: 개월당 $0.25\\%$ 균등 적용 ($Rate_{base} = Months \\times 0.0025$)
*   **기존 가입자**: 20년(240개월) 한도 내 개월당 $0.25\\%$, 초과 기간에 대해 개월당 $0.1667\\%$ 가산 적용
    $$Rate_{base} = \\min(240, Months) \\times 0.0025 + \\max(0, Months - 240) \\times 0.001667$$

최종 결정 지급률 $Rate_{final}$은 기본 비율에 특약 비율 $6.0\\%$를 더한 값입니다.
$$Rate_{final} = Rate_{base} + 0.06$$
$$Payout_{base} = BaseWage \\times (1 + g_{wage})^{RA_j - 2026} \\times Rate_{final}$$
*   $BaseWage$: 기준 표준보수 (1,450,000원)

---

#### 4.2.3 조기은퇴 감액 및 수급년차별 장기수급 감액 (슬라이딩 감액)

> [!WARNING]
> **중요: 장기 수급에 따른 단계적 감액 공식**
> 연금을 받기 시작한 지 오래될수록 기금 재정에 누적 부담을 주므로, 수급 기간에 따라 지급 비율 자체를 차감하는 장기수급 감액(슬라이딩)이 적용됩니다. 또한, 정년퇴직 연령($MandatoryAge$)보다 일찍 은퇴할 경우 연 3%씩 영구 감액됩니다.

1.  **조기 은퇴 감액율**: 정년 대비 조기 은퇴 연도당 $3\\%$ 영구 감액
    $$D_{early} = \\max \\left( 0.1, \\, 1.0 - \\max(0, MandatoryAge - RA_j) \\times 0.03 \\right)$$
2.  **수급 년차별 추가 감액 ($D_{sliding}$)**: 은퇴 이후 경과 년수 $k = y - RetireYear$에 따른 단계적 차감
    $$D_{sliding}(k) = \\begin{cases} 
    D_{early} & \\text{if } 0 \\le k < 10 \\quad (\\text{1~10년차: 조기은퇴 감액만 적용}) \\\\
    \\max(0, D_{early} - 0.10) & \\text{if } 10 \\le k < 15 \\quad (\\text{11~15년차: 추가 10%p 감액}) \\\\
    \\max(0, D_{early} - 0.15) & \\text{if } k \\ge 15 \\quad (\\text{16년차 이상: 추가 15%p 감액}) 
    \\end{cases}$$

#### 4.2.4 물가 연동 (CPI Indexing) 및 유족 연금 승계
*   **물가 연동 (CPI)**: 물가 상승에 따른 실질 가치 보전을 위해 물가 연동 토글 활성화 시 매년 물가상승률 $r_{cpi}$만큼 복리로 가산됩니다. ($CPI(k) = (1 + r_{cpi})^k$)
*   **유족 연금 승계**: 남성 가입자 사망 이후 배우자에게 승계될 때 지급률은 **50%**로 축소 적용됩니다.
    $$\\gamma_{survivor} = \\begin{cases} 1.0 & \\text{if } y < MaleDeathYear \\\\ 0.5 & \\text{if } y \\ge MaleDeathYear \\end{cases}$$

---

## 5. 계리적 부채 및 건전성 평가 모형 (Actuarial Valuation Model)

이 장은 대책위원회가 기금 고갈 연도 외에 가장 중요하게 살펴보아야 할 **재정 건전성 평가 모델**을 다룹니다.

### 5.1 계리 부채 (Actuarial Liability, $AL_y$)
*   **비유**: **"미래에 갚아야 할 외상값의 오늘 가격"**
*   **설명**: 현재 살아있는 모든 가입자가 사망할 때까지 지급해야 할 모든 연금액의 미래 가치를 구한 뒤, 이를 현재 시점의 할인율($d$, 기본값 $3.5\\%$)을 적용해 오늘짜 돈으로 환산한 총액입니다. 즉, 오늘 당장 연금 지급을 위해 기금이 준비하고 있어야 할 이론상의 필요 자산입니다.

1.  **일시금 선택 예정자 부채**:
    $$AL_{j, y}^{lump} = \\frac{LumpSumAmount}{(1 + d)^{RetireYear - y}}$$
2.  **정기 연금 수급 예정자 부채**:
    $$AL_{j, y}^{pension} = \\sum_{py = \\max(y, RetireYear)}^{\\lfloor FemaleDeathYear \\rfloor} \\frac{Payout_j(py)}{(1 + d)^{py - y}}$$
3.  **총 계리 부채**:
    $$AL_y = \\sum_{j \\in Active \\cup Retired} \\left( AL_{j, y}^{lump/pension} \\right)$$

---

### 5.2 기금 적립률 (Funding Ratio, $FR_y$)
*   **비유**: **"내 주머니 속 현금 대 미래 빚의 비율"**
*   **설명**: 현재 보유한 실제 자산($A_y$)을 계리 부채($AL_y$)로 나눈 백분율입니다.
    $$FR_y = \\frac{A_y}{AL_y} \\times 100\\,\\%$$
    - 적립률이 **$100\\%$ 이상**이다: 미래에 줄 연금 부채보다 현재 가진 돈이 더 많아 재정이 아주 건전하다는 뜻입니다.
    - 적립률이 **$100\\%$ 미만**이다: 장기적으로 기금이 약속된 연금을 다 주지 못할 위험(적자 상태)이 있음을 경고합니다.

---

### 5.3 수지 적자 전환 시점 (Operating Deficit Year)
*   **비유**: **"월급보다 생활비가 더 많이 나가 적금을 깨기 시작하는 해"**
*   **설명**: 기금이 가진 적립금의 '투자 수익(이자)'을 제외하고, 오직 가입자들이 매달 내는 **순수 기여금 수입**과 당해 연도에 지급해야 할 **연금액**만 비교했을 때 지출이 수입을 초과하는 최초의 시점입니다.
    $$y_{deficit} = \\min \\left\\{ y \\,|\\, CF_{in, y} < CF_{out, y} \\right\\}$$
    이 시점을 지나면 기금은 원금을 갉아먹거나 투자 자산을 처분하여 연금을 충당해야 하므로, 실질적인 기금 위기의 첫 번째 신호탄이 됩니다.

---

## 6. [심화 해설] 가상의 목회자 사례로 보는 연금 지급액 시뮬레이션

추상적인 공식을 넘어, 가상의 목회자 2명의 구체적 시나리오를 통해 연금 수령액이 어떻게 결정되는지 계산해 보겠습니다. (기준임금상승률 $1.5\\%$ 가정)

### 6.1 사례 A: 만 73세 정년 은퇴하는 김목사님 (장기수급 감액 케이스)
*   **인물 프로필**: 35년(420개월)간 성실히 납부하고, 제안 정년인 만 73세에 은퇴. 
*   **기본 표준보수**: 1,450,000원

#### [단계 1] 지급 결정율 계산
*   20년(240개월) 한도 분: $240 \\times 0.25\\% = 60\\%$
*   20년 초과 분(180개월): $180 \\times 0.1667\\% = 30\\%$
*   여기에 특약 가산 비율 $6.0\\%$ 합산:
    $$\\text{최종 결정율} = 60\\% + 30\\% + 6\\% = 96\\%$$

#### [단계 2] 은퇴 시점 기준 기본 연금액 산출 (30년 뒤 은퇴로 물가/임금 1.5배 상승 가정)
*   은퇴 시점의 인플레이션 반영 표준보수 = 약 2,260,000원
*   $$\\text{월 기본 지급액} = 2,260,000\\,\\text{원} \\times 96\\% = 2,169,600\\,\\text{원}$$

#### [단계 3] 수급 년차별 실제 월 수령액 시뮬레이션
김목사님은 만 73세 정년퇴직이므로 **조기 은퇴 감액(연 3%)은 전혀 적용되지 않습니다(100% 지급)**.
*   **1 ~ 10년차 (만 73세 ~ 82세)**: 감액 없음
    - **월 수령액**: **\`2,169,000원\`**
*   **11 ~ 15년차 (만 83세 ~ 87세)**: 장기 수급 10%p 감액 적용 ($100\\% - 10\\% = 90\\%$ 지급)
    - **월 수령액**: $2,169,600\\,\\text{원} \\times 90\\% =$ **\`1,952,000원\`** (천 원 미만 절사)
*   **16년차 이후 (만 88세 ~ 사망 시까지)**: 장기 수급 15%p 감액 적용 ($100\\% - 15\\% = 85\\%$ 지급)
    - **월 수령액**: $2,169,600\\,\\text{원} \\times 85\\% =$ **\`1,844,000원\`**

---

### 6.2 사례 B: 만 65세에 자원 은퇴하는 이목사님 (조기은퇴 및 유족승계 케이스)
*   **인물 프로필**: 25년(300개월)간 납부하고 만 65세에 조기(자원) 은퇴.
*   **정년퇴직 기준 연령**: 만 73세
*   **기본 표준보수**: 1,450,000원

#### [단계 1] 지급 결정율 계산
*   20년(240개월) 한도 분: $240 \\times 0.25\\% = 60\\%$
*   20년 초과 분(60개월): $60 \\times 0.1667\\% = 10\\%$
*   여기에 특약 가산 비율 $6.0\\%$ 합산:
    $$\\text{결정율} = 60\\% + 10\\% + 6\\% = 76\\%$$

#### [단계 2] 은퇴 시점 기준 기본 연금액 산출 (20년 뒤 은퇴 가정)
*   은퇴 시점의 인플레이션 반영 표준보수 = 약 1,950,000원
*   $$\\text{월 기본 지급액} = 1,950,000\\,\\text{원} \\times 76\\% = 1,482,000\\,\\text{원}$$

#### [단계 3] 조기 은퇴 영구 감액율 계산
*   정년(만 73세) 대비 8년 일찍 은퇴함에 따라 **매년 3%씩 영구 감액**됩니다.
    $$\\text{조기 은퇴 감액율} = 100\\% - (8\\,\\text{년} \\times 3\\%) = 76\\%$$
*   따라서 은퇴 초기 기본 월 지급액은 다음과 같습니다.
    $$1,482,000\\,\\text{원} \\times 76\\% = 1,126,320\\,\\text{원}$$

#### [단계 4] 수급 년차별 실제 월 수령액 및 유족 승계 시뮬레이션
*   **1 ~ 10년차 (만 65세 ~ 74세)**: 조기 은퇴 감액(76%)만 적용
    - **월 수령액**: **\`1,126,000원\`**
*   **11 ~ 15년차 (만 75세 ~ 79세)**: 장기 수급 10%p 감액 적용 ($76\\% - 10\\% = 66\\%$ 지급)
    - **월 수령액**: $1,482,000\\,\\text{원} \\times 66\\% =$ **\`978,000원\`**
*   **16년차 이후 ~ 사망 전 (만 80세 ~ 81세 사망 가정)**: 장기 수급 15%p 감액 적용 ($76\\% - 15\\% = 61\\%$ 지급)
    - **월 수령액**: $1,482,000\\,\\text{원} \\times 61\\% =$ **\`904,000원\`**
*   **이목사님 사망 후 배우자 유족연금 수령기 (배우자 87세 사망 시까지)**:
    - 사망 후 배우자에게는 본인 수령액(16년차 기준 61%)의 **50%만 승계**됩니다.
    - **월 수령액**: $904,000\\,\\text{원} \\times 50\\% =$ **\`452,000원\`**

---

## 7. [정책 가이드] 핵심 변수 조율에 따른 재정적 트레이드오프 (Trade-off)

대책위원회가 연금 재정을 살리기 위해 슬라이더(변수)를 움직일 때 발생하는 수학적 이해득실(Trade-off) 표입니다.

| 정책 선택 (변수 조정) | 장점 (재정적 혜택) | 단점 (반발 및 부작용) | 시뮬레이터 상의 연동 효과 |
| :--- | :--- | :--- | :--- |
| **정년 은퇴 연령 인상**<br>($70\\text{세} \\rightarrow 73\\text{세}$) | 연금 수급 시작 시점이 3년 뒤로 지연되어 **지출(Outflow)이 급격히 감소**하며, 3년간 추가 납입 수입이 발생합니다. | 목회자들의 실질 활동 기간이 늘어나 은퇴 후 노후 설계가 지연됩니다. | 기금 고갈 시점이 평균 10~15년 뒤로 늦춰지고, 계리 부채($AL$)가 즉각 크게 감소합니다. |
| **기여율(보험료율) 인상**<br>($9\\%\\rightarrow 12\\%$) | 매년 들어오는 **기여금 수입(Inflow)이 즉각 33% 증가**하여 자산 규모가 빠르게 우상향합니다. | 개별 목회자와 지교회의 월 납입 재정 부담이 직접적으로 가중됩니다. | 적립률($FR$) 곡선이 가파르게 상승하며, 수지적자 전환시점이 크게 지연됩니다. |
| **미자립교회 재정보조율 인상**<br>($0\\%\\rightarrow 50\\%$) | 총회 보조금 투입으로 미자립교회의 **완납율이 67%에서 78.5%로 상승**하여 장기적으로 성실 납입이 안착됩니다. | 총회가 매년 기금 밖에서 추가로 지출해야 하는 **보조금 비용이 증가**합니다. | 단기적으로는 보조금 지출로 지출 곡선이 올라가지만, 장기적으로 완납 가입자 수가 늘어 재정 안정성이 다소 보전됩니다. |
| **물가 연동(CPI) 도입**<br>(토글 활성화) | 은퇴 목회자의 연금 실질 가치가 보장되어 노후 생활비가 안정됩니다. | 기금이 미래에 짊어져야 할 **지출 금액이 매년 복리로 늘어납니다.** | 계리 부채($AL$)가 즉시 20~30% 폭등하여 적립률($FR$)이 크게 떨어지고 고갈이 대폭 앞당겨집니다. |

---

## 8. 용어 사전 (Glossary for Denominational Pension)

*   **마이크로 시뮬레이션 (Micro-simulation)**: 전체 가입자를 통째로 뭉뚱그려 평균값으로 계산하지 않고, DB 내의 3,196명 개개인의 나이, 납입액, 은퇴 연도 등을 각각 추적하여 합산하는 정밀한 현대적 예측 기법입니다.
*   **계리 부채 (Actuarial Liability)**: 가입자들에게 평생 줄 연금을 오늘 시점의 일시불 가격으로 환산한 값으로, 기금이 장기적으로 갚아야 할 약속된 부채입니다.
*   **적립률 (Funding Ratio)**: 현재 기금이 가진 실질 자산을 계리 부채로 나눈 값입니다. $100\\%$가 넘어야 장기적인 약속을 지킬 수 있는 안전한 상태입니다.
*   **수지 적자 전환 연도 (Operating Deficit Year)**: 이자 수익을 뺀 순수 보험료 수입보다 연금 지출이 많아지기 시작하는 첫 연도입니다.
*   **수리적 할인율 (Discount Rate)**: 미래의 100원이 오늘 기준으로는 얼마의 가치인지를 계산할 때 적용하는 이율입니다. 할인율이 높게 설정될수록 부채 금액은 작게 평가됩니다.
*   **일시금 퇴출 (Lump-sum Leakage)**: 은퇴할 때 매월 연금을 받는 대신 일정한 목돈(예: 8천만 원)을 한 번에 다 타가고 연금 가입자 명단에서 완전히 탈퇴하는 비율입니다.

---

## 9. 결론 (Conclusion)

본 논문 및 해설서에서 제안한 계리적 수리 모델은 데이터 오류를 평탄화하는 통계적 보정을 적용하고, 실제 은퇴 수급자 1,018명의 연령 분포와 6대 리스크 변수(저출생 감소율, 수명 연장, 미자립교회 재정보조 등)를 수학적으로 연계하여 모의 정밀도를 극대화하였습니다.

특히, 단순히 기금이 완전히 바닥나는 **'고갈 연도'**만을 보던 과거의 방식에서 벗어나, 미래의 부채 의무 대비 기금의 체력을 보여주는 **'계리적 적립률(Funding Ratio)'**과 기금이 실질적으로 원금을 갉아먹기 시작하는 **'수지 적자 전환 시점'**을 다각도로 도출해 냄으로써, 교단 연금 기금의 장기 생존 여부를 판가름할 객관적이고 고도화된 이정표를 확립하였습니다. 

본 모델과 시뮬레이터는 향후 교단 연금 재정 개혁의 핵심적인 과학적 근거 자료로써 대책위원회의 현명한 정책 결정을 견인할 것입니다.`;

export default function PaperViewerPage() {
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    // marked markdown compile (breaks, gfm 활성화)
    const renderMarkdown = async () => {
      const parsed = await marked(MARKDOWN_CONTENT, {
        breaks: true,
        gfm: true
      });
      setHtmlContent(parsed);
    };
    renderMarkdown();
  }, []);

  return (
    <div className="paper-container" style={{ minHeight: '100vh', padding: '2rem 1.5rem', fontFamily: '"Inter", "Outfit", "Noto Sans KR", sans-serif' }}>
      {/* 스타일 강제 인젝트 (글래스모피즘 테마 및 인쇄용 고대비 CSS) */}
      <style>{`
        /* --- Web UI styles (Dark Glassmorphism) --- */
        body {
          background-color: #0f172a;
          color: #f1f5f9;
        }

        .paper-card {
          max-width: 900px;
          margin: 0 auto;
          background: rgba(30, 41, 59, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 3.5rem 3rem;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          line-height: 1.75;
        }

        .no-print-bar {
          max-width: 900px;
          margin: 0 auto 1.5rem auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 0.75rem 1.5rem;
        }

        /* Markdown Contents Styling */
        .markdown-body h1 {
          font-size: 2.2rem;
          font-weight: 800;
          color: #fff;
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 0.8rem;
          margin-top: 0;
          margin-bottom: 1.5rem;
          line-height: 1.3;
          text-align: center;
        }

        .markdown-body h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fbbf24; /* Amber 400 */
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 0.4rem;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
        }

        .markdown-body h3 {
          font-size: 1.2rem;
          font-weight: 600;
          color: #38bdf8; /* Sky 400 */
          margin-top: 1.8rem;
          margin-bottom: 0.8rem;
        }

        .markdown-body p {
          margin-bottom: 1.25rem;
          font-size: 1.025rem;
          color: #cbd5e1; /* Slate 300 */
          text-align: justify;
        }

        .markdown-body strong {
          color: #fff;
          font-weight: 700;
        }

        .markdown-body blockquote {
          border-left: 4px solid #38bdf8;
          background: rgba(56, 189, 248, 0.08);
          padding: 1rem 1.25rem;
          border-radius: 0 8px 8px 0;
          margin: 1.5rem 0;
        }
        
        .markdown-body blockquote p {
          margin: 0;
          color: #93c5fd; /* Blue 300 */
          font-size: 0.95rem;
        }

        .markdown-body hr {
          border: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin: 2rem 0;
        }

        /* Table styles */
        .markdown-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 0.9rem;
        }

        .markdown-body th {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          font-weight: 700;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 0.6rem 0.8rem;
          text-align: left;
        }

        .markdown-body td {
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.6rem 0.8rem;
          color: #cbd5e1;
        }

        .markdown-body tr:nth-child(even) {
          background: rgba(255, 255, 255, 0.01);
        }

        /* Code highlight */
        .markdown-body code {
          font-family: Menlo, Monaco, Consolas, Courier New, monospace;
          background: rgba(0, 0, 0, 0.3);
          color: #f472b6;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .markdown-body pre {
          background: #090d16;
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1.5rem 0;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .markdown-body pre code {
          background: transparent;
          color: #e2e8f0;
          padding: 0;
          font-size: 0.85rem;
        }

        /* Bullet lists */
        .markdown-body ul, .markdown-body ol {
          margin-bottom: 1.25rem;
          padding-left: 1.5rem;
          color: #cbd5e1;
        }

        .markdown-body li {
          margin-bottom: 0.4rem;
        }

        /* --- Print Mode styles (A4 High Contrast) --- */
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }

          .no-print {
            display: none !important;
          }

          .paper-card {
            max-width: 100% !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            color: #000000 !important;
            line-height: 1.6;
          }

          .markdown-body h1 {
            color: #000000 !important;
            border-bottom: 2px solid #000000 !important;
            margin-top: 0 !important;
            font-size: 24pt !important;
          }

          .markdown-body h2 {
            color: #000000 !important;
            border-bottom: 1px solid #000000 !important;
            page-break-after: avoid;
            font-size: 16pt !important;
            margin-top: 30pt !important;
          }

          .markdown-body h3 {
            color: #000000 !important;
            page-break-after: avoid;
            font-size: 13pt !important;
          }

          .markdown-body p {
            color: #000000 !important;
            font-size: 10.5pt !important;
          }

          .markdown-body strong {
            color: #000000 !important;
          }

          .markdown-body blockquote {
            border-left: 3px solid #000000 !important;
            background: #f8fafc !important;
            color: #000000 !important;
            padding: 0.8rem 1rem !important;
          }

          .markdown-body blockquote p {
            color: #000000 !important;
            font-size: 10pt !important;
          }

          .markdown-body table {
            page-break-inside: auto;
            border: 1px solid #000000 !important;
          }

          .markdown-body tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          .markdown-body th {
            background: #f1f5f9 !important;
            color: #000000 !important;
            border: 1px solid #000000 !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .markdown-body td {
            color: #000000 !important;
            border: 1px solid #000000 !important;
          }

          .markdown-body code {
            background: #f1f5f9 !important;
            color: #000000 !important;
            border: 1px solid #e2e8f0 !important;
          }

          .markdown-body pre {
            background: #f8fafc !important;
            border: 1px solid #cbd5e1 !important;
            page-break-inside: avoid;
          }

          .markdown-body pre code {
            color: #000000 !important;
          }

          .markdown-body ul, .markdown-body ol {
            color: #000000 !important;
          }
        }
      `}</style>

      {/* 1. NO PRINT BAR (TOP CONTROLS) */}
      <div className="no-print-bar no-print">
        <Link 
          href="/committee"
          style={{
            textDecoration: 'none',
            fontSize: '0.9rem',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
        >
          <span>🔙 대책위 대시보드로 돌아가기</span>
        </Link>

        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.print();
            }
          }}
          style={{
            padding: '0.5rem 1.2rem',
            fontSize: '0.85rem',
            fontWeight: '700',
            background: 'var(--primary, #3b82f6)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2563eb';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--primary, #3b82f6)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          🖨️ 인쇄 및 PDF 저장 (A4)
        </button>
      </div>

      {/* 2. PAPER CARD BODY (HTML CONVERTED) */}
      <article className="paper-card animate-fade-in">
        <div 
          className="markdown-body" 
          dangerouslySetInnerHTML={{ __html: htmlContent }} 
        />
      </article>
    </div>
  );
}
