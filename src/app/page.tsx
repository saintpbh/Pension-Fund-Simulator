'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Minister {
  MinisterCode: string;
  MinisterName: string;
  BirthDay: string;
  AnsuDate: string;
  Tel_Mobile: string;
  PenNo: string | null;
  ChrName: string | null;
  NohName: string | null;
}

interface Rate {
  YY: string;
  DefaultPay: number;
  LessCont: number;
  OverCont: number;
  Share: number;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [ministers, setMinisters] = useState<Minister[]>([]);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<Rate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);

  // 최근 연금 기준 정보 조회
  useEffect(() => {
    fetch('/api/pension/rates')
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setRates(res.data.slice(0, 3)); // 최근 3개년만 표시
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setRatesLoading(false));
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/ministers?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setMinisters(data.data);
      } else {
        alert('검색 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버와 통신하는 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 생년월일 포맷팅
  const formatBirth = (birth: string) => {
    if (!birth || birth.trim().length !== 8) return '-';
    return `${birth.slice(0, 4)}.${birth.slice(4, 6)}.${birth.slice(6, 8)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Panel */}
      <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>기장 교단 연금 시뮬레이터</h1>
          <p className="sub-title">한국기독교장로회 총회 목회자 연금 조회 및 예측 시스템</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span className="badge badge-success">DB Connected</span>
          <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>v1.0.0</span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="dashboard-grid">
        {/* Left: Search & Results */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            목회자 연금 조회
          </h2>
          
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="목회자 성명, 노회명 또는 교회명을 입력하세요 (예: 홍길동)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '검색 중...' : '검색'}
            </button>
          </form>

          {/* Results Area */}
          <div style={{ flex: 1 }}>
            {ministers.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>목회자명</th>
                      <th>생년월일</th>
                      <th>소속 노회</th>
                      <th>소속 교회</th>
                      <th>연금번호</th>
                      <th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ministers.map((minister) => (
                      <tr key={minister.MinisterCode}>
                        <td style={{ fontWeight: '600' }}>{minister.MinisterName}</td>
                        <td>{formatBirth(minister.BirthDay)}</td>
                        <td>{minister.NohName || '-'}</td>
                        <td>{minister.ChrName || '-'}</td>
                        <td>
                          {minister.PenNo ? (
                            <span className="badge badge-success">{minister.PenNo}</span>
                          ) : (
                            <span className="badge badge-warning">미가입</span>
                          )}
                        </td>
                        <td>
                          {minister.PenNo ? (
                            <Link href={`/pension/${minister.PenNo}`} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem', borderRadius: 'var(--radius-sm)' }}>
                              시뮬레이션
                            </Link>
                          ) : (
                            <button disabled style={{ padding: '0.4rem 0.8rem', fontSize: '0.825rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', cursor: 'not-allowed' }}>
                              시뮬레이션 불가
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
                {loading ? (
                  <p>데이터베이스에서 목회자 정보를 조회하고 있습니다...</p>
                ) : (
                  <div>
                    <p style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '0.5rem' }}>검색 결과가 없습니다.</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>상단의 검색창을 이용해 목회자를 조회해 주세요.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right: Side Statistics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Rate Card */}
          <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>최근 연도별 기준 봉급표</h2>
            <p className="sub-title" style={{ fontSize: '0.85rem' }}>연금 예측 계산의 기준이 되는 표준 급여 정보입니다.</p>

            {ratesLoading ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>불러오는 중...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                {rates.map((rate) => (
                  <div key={rate.YY} style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--primary)' }}>{rate.YY}년도</div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        본인 부담: {(rate.LessCont || 0).toLocaleString()}원
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.925rem', fontWeight: '600' }}>
                        {(rate.DefaultPay || 0).toLocaleString()}원
                      </div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--success)' }}>
                        매칭 지원: {(rate.Share || 0).toLocaleString()}원
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick Guide */}
          <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', lineHeight: '1.6' }}>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>이용 안내</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              1. 성명, 소속 교회명 또는 노회명을 입력하여 해당 목회자를 검색하십시오.
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>
              2. 검색 결과에서 연금 번호가 등록된 목회자의 <strong>'시뮬레이션'</strong> 버튼을 클릭하십시오.
            </p>
            <p style={{ color: 'var(--text-secondary)' }}>
              3. 상세 페이지에서 은퇴 예정 연령, 추가 납입액, 미래 이자율 조정을 통해 예상되는 연금 수령액과 납입 추이 그래프를 실시간으로 확인하실 수 있습니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
