export const teacher = {
  th: {
    teacher: {
      logout: "ออกจากระบบ",
      deleteQuestionConfirm: "แน่ใจหรือไม่ว่าต้องการลบคำถามนี้?",
      deleteQuestionWarning:
        "ข้อมูลที่เกี่ยวข้องกับคำถามนี้จะถูกลบด้วย และไม่สามารถย้อนกลับได้",
    },
  },
  en: {
    teacher: {
      logout: "Logout",
      deleteQuestionConfirm: "Are you sure you want to delete this question?",
      deleteQuestionWarning:
        "Related data for this question will also be deleted and this action cannot be undone.",
      deleteActivityTitle: "Delete this activity?",
      deleteActivityWarning:
        "The activity will be removed from your dashboard. Existing session history and results will be preserved.",
      deleteActivity: "Delete activity",
      deletingActivity: "Deleting…",
    },
  },
};

Object.assign(teacher.th.teacher, {
  deleteActivityTitle: "ลบกิจกรรมนี้หรือไม่?",
  deleteActivityWarning:
    "กิจกรรมจะถูกนำออกจากแดชบอร์ด แต่ประวัติเซสชันและผลลัพธ์เดิมจะยังคงอยู่",
  deleteActivity: "ลบกิจกรรม",
  deletingActivity: "กำลังลบ…",
});
