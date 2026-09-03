import React from 'react';
import { useTranslation } from 'react-i18next';
import './Features.css';
import { MAX_UPLOAD_MB } from '../lib/constants';

function Features() {
  const { t } = useTranslation();
  return (
    <section className="features">
      <div className="features-container">
        <div className="features-header">
          <div className="features-title-wrapper">
            <h2 className="features-title">{t('features.title')}</h2>
          </div>
          <div className="features-description-wrapper">
            <p className="features-description">{t('features.subtitle')}</p>
          </div>
        </div>

        <div className="features-cards">
          <div className="feature-card">
            <div className="feature-card-inner">
              <div className="feature-icons">
                <svg className="feature-icon-arrow" width="141" height="93" viewBox="0 0 141 93" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.05811 45.1722L82.7952 52.3014M10.8907 31.6839L93.8373 45.1722L90.4337 6.22004L137.58 53.366L87.4083 87.78L92.1985 60.8034C67.2809 62.9044 17.118 67.1064 15.807 67.1064" stroke="currentColor" strokeWidth="4.078"/>
                </svg>
                <svg className="feature-icon-wave" width="68" height="126" viewBox="0 0 68 126" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.57959 82.0152C16.4857 73.1442 14.9481 52.6916 4.04959 42.9362M14.3322 99.7147C36.7027 88.7032 45.5308 48.7832 21.0091 26.8336M20.7203 123C65.576 106.545 82.5717 40.7533 40.3944 3.00006" stroke="currentColor" strokeWidth="6"/>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-card-title">{t('features.card1.title')}</h3>
                <p className="feature-card-text">{t('features.card1.body', { size: MAX_UPLOAD_MB })}</p>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-card-inner">
              <div className="feature-icons">
                <svg className="feature-icon-hands" width="98" height="118" viewBox="0 0 98 118" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M53.2349 55.1585C53.2349 55.1585 50.3218 35.3312 43.9572 20.1699M66.6458 52.027C65.5265 38.8787 62.9437 30.5255 59.8373 25.4277M78.5999 92.908C79.0017 90.3371 79.4379 86.9296 79.8172 83.0035M38.5737 102.751C38.5737 102.751 34.0528 99.1405 28.7148 94.3527M58.9541 65.5499C61.4868 71.3104 62.2151 78.2575 62.2151 83.0035M43.4213 68.7311C46.0816 74.1477 47.2487 79.1689 48.4845 84.809M28.7148 94.3527C16.6776 83.556 -1.91991 64.2892 4.54629 53.255C12.8959 39.0068 33.1828 58.8476 33.1828 58.8476C33.1828 58.8476 6.0396 9.04436 25.4438 3.55949C33.4121 1.30714 39.5225 9.60584 43.9572 20.1699M28.7148 94.3527C28.7148 94.3527 19.5383 100.969 22.2686 108.856C27.4176 123.73 98.6435 108.254 94.1829 89.7684C92.0807 81.0568 79.8172 83.0035 79.8172 83.0035M79.8172 83.0035C82.1093 59.2753 81.8928 16.8054 59.8373 25.4277M59.8373 25.4277C54.501 16.6705 47.6196 17.5195 43.9572 20.1699" stroke="currentColor" strokeWidth="5.58119"/>
                </svg>
                <svg className="feature-icon-pencil" width="106" height="119" viewBox="0 0 106 119" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5.81706 60.1564L67.3789 3.18811C73.0492 3.18811 79.0474 5.27503 84.4832 8.63994M5.81706 60.1564L4.60043 87.4841M5.81706 60.1564C13.5413 59.5635 22.2875 61.7361 30.4836 65.7743M59.3491 96.4311L102.783 32.0374C101.876 27.8725 99.754 23.6754 96.8296 19.8215M59.3491 96.4311L31.3664 105.621M59.3491 96.4311C57.5698 90.2982 53.832 84.418 48.922 79.2406M4.60043 87.4841L3.38379 114.812L31.3664 105.621M4.60043 87.4841C4.60043 87.4841 12.6751 88.9232 19.4434 93.5096C26.2117 98.096 31.3664 105.621 31.3664 105.621M48.922 79.2406L96.8296 19.8215M48.922 79.2406C43.7653 73.803 37.3156 69.1405 30.4836 65.7743M96.8296 19.8215C93.5354 15.4801 89.2231 11.5741 84.4832 8.63994M30.4836 65.7743L84.4832 8.63994" stroke="currentColor" strokeWidth="5.58119"/>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-card-title">{t('features.card2.title')}</h3>
                <p className="feature-card-text">{t('features.card2.body')}</p>
              </div>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-card-inner">
              <div className="feature-icons">
                <svg className="feature-icon-check" width="115" height="107" viewBox="0 0 115 107" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.3796 48.3078L52.9307 80.0973C62.334 63.6747 87.4382 25.1051 112.628 2.20728M2.83154 22.149L7.2796 103.793L90.271 98.2794L84.5353 18.1606L2.83154 22.149Z" stroke="currentColor" strokeWidth="5.07927"/>
                </svg>
                <svg className="feature-icon-smile" width="108" height="108" viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M71.5608 29.6127L74.8828 42.3141M37.8419 40.1415L43.6555 53.3442M104.302 51.3006C106.988 82.3629 82.2605 104.413 54.3003 104.786C26.3402 105.160 7.28538 88.8449 3.10792 60.161C-1.06954 31.4771 22.6839 5.708 49.0934 3.39561C75.503 1.08322 101.615 20.2383 104.302 51.3006ZM56.7149 77.5805C53.4753 69.9823 57.1378 62.5481 63.3648 60.3124C69.5919 58.0768 75.2429 60.7159 78.6142 67.6023C81.9855 74.4887 78.8571 82.7826 73.1418 85.3866C67.4265 87.9907 59.9545 85.1786 56.7149 77.5805Z" stroke="currentColor" strokeWidth="5.07927"/>
                </svg>
              </div>
              <div className="feature-content">
                <h3 className="feature-card-title">{t('features.card3.title')}</h3>
                <p className="feature-card-text">{t('features.card3.body')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Features;
