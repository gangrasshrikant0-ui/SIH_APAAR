import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { collegeApi } from "../api/collegeApi";

export function CollegeNotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notices: [], unreadCount: 0 });
  const panelRef = useRef(null);

  const load = async () => {
    try {
      const result = await collegeApi.getNotifications();
      setData(result);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markRead = async (noticeId) => {
    const result = await collegeApi.markNotificationRead(noticeId);
    setData(result);
  };

  return (
    <div className="college-notice-wrap" ref={panelRef}>
      <button
        type="button"
        className="college-notice-bell"
        aria-label={`Notifications, ${data.unreadCount} unread`}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          if (!open) load();
        }}
      >
        <Bell size={18} />
        {data.unreadCount > 0 && (
          <span className="college-notice-count">{data.unreadCount > 9 ? "9+" : data.unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="college-notice-panel" role="dialog" aria-label="College notifications">
          <div className="college-notice-panel-header">
            <strong>Notifications</strong>
            <span>Updates for your institution</span>
          </div>
          {data.notices.length === 0 ? (
            <p className="college-notice-empty">No notices for this institution.</p>
          ) : (
            <ul>
              {data.notices.map((notice) => (
                <li key={notice.id} className={notice.read ? "read" : "unread"}>
                  <button type="button" className="college-notice-item" onClick={() => markRead(notice.id)}>
                    <strong>{notice.title}</strong>
                    <span className="college-notice-meta">
                      {notice.institutionName} · {notice.category === "AICTE" || notice.category === "SYSTEM" ? "Reviewer" : "Institution"}
                      {notice.issueId ? ` · ${notice.issueId}` : ""}
                    </span>
                    <p>{notice.body}</p>
                  </button>
                  {notice.href && (
                    <Link to={notice.href} className="college-notice-link" onClick={() => { markRead(notice.id); setOpen(false); }}>
                      Open related workbench
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
