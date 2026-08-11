import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import DismissibleError from '../components/DismissibleError'
import { loadPublicPlansPage, setPublicPlansOffset } from '../store/publicPlansSlice'

function PlanLogo({ plan }) {
  return plan.logo_url
    ? <img src={plan.logo_url} alt="" loading="lazy" />
    : <span>{plan.name?.charAt(0)?.toUpperCase() || '?'}</span>
}

export default function PublicPlans() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { pages, offset, limit, total } = useSelector(state => state.publicPlans)
  const page = pages[String(offset)] || { items: [], status: 'idle', error: null }
  const plans = page.items || []
  const loading = ['idle', 'loading'].includes(page.status)
  const error = page.error

  React.useEffect(() => {
    dispatch(loadPublicPlansPage({ offset, limit }))
  }, [dispatch, limit, offset])

  const pageNumber = Math.floor(offset / limit) + 1
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const firstItem = total ? offset + 1 : 0
  const lastItem = Math.min(offset + plans.length, total)

  return <div className="public-plans-page">
    <header className="public-plans-header">
      <div>
        <span className="public-plans-eyebrow">Community learning library</span>
        <h1>Public learning plans</h1>
        <p>Explore complete learning paths shared in read-only mode. Open any plan to browse its courses, modules, and resources.</p>
      </div>
    </header>

    {error && <DismissibleError message={error} />}
    {loading ? (
      <div className="public-plan-status"><span className="spinner" /> Loading public learning plans...</div>
    ) : plans.length ? (
      <section className="public-plan-library-grid" aria-label="Public learning plans">
        {plans.map(plan => (
          <button type="button" className="public-plan-library-card" key={plan.share_id} onClick={() => navigate(`/public/plans/${plan.share_id}`)}>
            <span className="public-plan-library-logo"><PlanLogo plan={plan} /></span>
            <span className="public-plan-library-copy">
              <small>Published learning plan</small>
              <strong>{plan.name}</strong>
              <code className="public-plan-library-id" title={plan.plan_id}>ID: {plan.plan_id}</code>
              <p>{plan.description || 'Open this plan to explore its complete curriculum.'}</p>
              <span className="public-plan-library-counts">
                <b>{plan.course_count || 0}<i>Courses</i></b>
                <b>{plan.module_count || 0}<i>Modules</i></b>
                <b>{plan.video_count || 0}<i>Videos</i></b>
              </span>
            </span>
            <span className="public-plan-library-arrow" aria-hidden="true">›</span>
          </button>
        ))}
      </section>
    ) : (
      <section className="public-plan-library-empty">
        <strong>No public learning plans yet</strong>
        <p>Published plans will appear here automatically.</p>
      </section>
    )}
    {!loading && !error && total > 0 && <nav className="public-plans-pagination" aria-label="Public learning plans pages">
      <button type="button" disabled={offset === 0} onClick={() => dispatch(setPublicPlansOffset(offset - limit))} aria-label="Previous public plans page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span>Previous</span></button>
      <span><strong>Page {pageNumber} of {pageCount}</strong><small>{firstItem}–{lastItem} of {total} plans</small></span>
      <button type="button" disabled={offset + limit >= total} onClick={() => dispatch(setPublicPlansOffset(offset + limit))} aria-label="Next public plans page"><span>Next</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>
    </nav>}
  </div>
}
