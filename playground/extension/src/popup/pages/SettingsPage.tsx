import { useState, useEffect } from 'react';
import { ArrowLeft, User, Bell, Store, ExternalLink } from 'lucide-react';
import type { UserInfo } from '../../core/types';
import { getAllProviders } from '../../providers/registry';
import { Toggle } from '../components/Toggle';

interface SettingsPageProps {
  userInfo: UserInfo | null;
  onSave: (info: UserInfo) => Promise<void>;
  onBack: () => void;
}

export const SettingsPage = ({ userInfo, onSave, onBack }: SettingsPageProps) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [browserNotif, setBrowserNotif] = useState(true);
  const [soundNotif, setSoundNotif] = useState(false);
  const [providers] = useState(() => getAllProviders());

  useEffect(() => {
    if (userInfo) {
      setName(userInfo.name);
      setPhone(userInfo.phone);
    }
  }, [userInfo]);

  const handleSave = async () => {
    await onSave({ name, phone });
    onBack();
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="settings-header">
        <button className="settings-back" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <span className="settings-title">설정</span>
      </div>
      <div className="divider" />

      {/* User Info */}
      <div className="section" style={{ gap: 16 }}>
        <div className="info-header">
          <User size={16} className="info-header-icon" />
          <span className="info-header-text">기본 정보</span>
        </div>

        <div className="field-group" style={{ gap: 6 }}>
          <span className="field-label">이름</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
          />
        </div>

        <div className="field-group" style={{ gap: 6 }}>
          <span className="field-label">연락처</span>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
          />
        </div>


      </div>
      <div className="divider" />

      {/* Notification Settings */}
      <div className="section" style={{ gap: 16 }}>
        <div className="info-header">
          <Bell size={16} className="info-header-icon" />
          <span className="info-header-text">알림 설정</span>
        </div>

        <div className="toggle-row">
          <span className="toggle-label">브라우저 알림</span>
          <Toggle value={browserNotif} onChange={setBrowserNotif} />
        </div>

        <div className="toggle-row">
          <span className="toggle-label">사운드 알림</span>
          <Toggle value={soundNotif} onChange={setSoundNotif} />
        </div>
      </div>
      <div className="divider" />

      {/* Providers */}
      <div className="section" style={{ gap: 16 }}>
        <div className="info-header">
          <Store size={16} className="info-header-icon" />
          <span className="info-header-text">등록된 업체</span>
        </div>

        <div className="provider-list">
          {providers.map((p) => (
            <a
              key={p.meta.id}
              className="provider-item"
              href={p.meta.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="provider-item-name">{p.meta.name}</span>
              <ExternalLink size={14} className="provider-item-link" />
            </a>
          ))}
        </div>
      </div>
      <div className="divider" />

      {/* Save */}
      <div className="bottom-bar">
        <button className="btn-primary" onClick={handleSave}>
          저장
        </button>
      </div>
    </div>
  );
};
