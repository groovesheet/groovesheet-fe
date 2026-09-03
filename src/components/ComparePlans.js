import React from 'react';
import './ComparePlans.css';
import { MAX_UPLOAD_MB } from '../lib/constants';

function ComparePlans() {
  return (
    <section className="compare-plans">
      <div className="compare-container">
        <h2 className="compare-title">Compare Plans</h2>
        
        <div className="compare-table-wrapper">
          <div className="compare-table">
            <div className="compare-header-row">
              <div className="compare-cell empty"></div>
              <div className="compare-cell plan-header">
                <h5 className="plan-header-name">Lite pack</h5>
              </div>
              <div className="compare-cell plan-header">
                <h5 className="plan-header-name">Pro pack</h5>
              </div>
              <div className="compare-cell plan-header">
                <h5 className="plan-header-name">Plus pack</h5>
              </div>
            </div>

            <div className="compare-row">
              <div className="compare-cell feature-name">
                <span className="feature-label">Minutes</span>
              </div>
              <div className="compare-cell feature-value">
                <span>90 Minutes</span>
              </div>
              <div className="compare-cell feature-value">
                <span>500 Minutes</span>
              </div>
              <div className="compare-cell feature-value">
                <span>300 Minutes</span>
              </div>
            </div>

            <div className="compare-row">
              <div className="compare-cell feature-name">
                <span className="feature-label">Fast Processing Queue</span>
              </div>
              <div className="compare-cell feature-value">
                <span className="dash">–</span>
              </div>
              <div className="compare-cell feature-value">
                <svg className="checkmark" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008" stroke="#F4F4F4" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="compare-cell feature-value">
                <svg className="checkmark" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008" stroke="#F4F4F4" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <div className="compare-row">
              <div className="compare-cell feature-name">
                <span className="feature-label">Upload Size Limit per File</span>
              </div>
              <div className="compare-cell feature-value">
                <span>{`${MAX_UPLOAD_MB} MB`}</span>
              </div>
              <div className="compare-cell feature-value">
                <span>{`${MAX_UPLOAD_MB} MB`}</span>
              </div>
              <div className="compare-cell feature-value">
                <span>{`${MAX_UPLOAD_MB} MB`}</span>
              </div>
            </div>

            <div className="compare-row">
              <div className="compare-cell feature-name">
                <span className="feature-label">Result Downloads</span>
              </div>
              <div className="compare-cell feature-value">
                <svg className="checkmark" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008" stroke="#F4F4F4" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="compare-cell feature-value">
                <svg className="checkmark" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008" stroke="#F4F4F4" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="compare-cell feature-value">
                <svg className="checkmark" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008" stroke="#F4F4F4" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <div className="compare-row">
              <div className="compare-cell feature-name">
                <span className="feature-label">Batch Processing</span>
              </div>
              <div className="compare-cell feature-value">
                <svg className="checkmark" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008" stroke="#F4F4F4" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="compare-cell feature-value">
                <svg className="checkmark" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008" stroke="#F4F4F4" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="compare-cell feature-value">
                <svg className="checkmark" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4.79932 12.1501L10.5593 17.9101L19.1993 7.83008" stroke="#F4F4F4" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ComparePlans;
