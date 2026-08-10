import React from 'react'
import { useNavigate } from 'react-router-dom'

import DismissibleError from '../components/DismissibleError'
import { getPublicPlans } from '../api/client'

function PlanLogo({ plan }) {
  return plan.logo_url
    ? <img src={plan.logo_url} alt="" loading="lazy" />
    : <span>{plan.name?.charAt(0)?.toUpperCase() || '?'}</span>
}

export default function PublicPlans() {
  const navigate = useNavigate()
  const [plans, setPlans] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let active = true
    getPublicPlans()
      .then(response => {
        if (active) setPlans(response.plans || [])
      })
      .catch(requestError => {
        if (active) setError(requestError.message || 'Unable to load public learning plans.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

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
  </div>
}
