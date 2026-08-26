' ================================================================
' RunArchiveTask.vbs
' Script chay boi Windows Task Scheduler (KHONG phai VBA cua Outlook) -
' tu dong ket noi toi Outlook dang mo (hoac tu mo neu chua chay), roi
' goi macro ArchiveOldCampaignSentItems trong CampaignTracker.bas.
'
' CACH CAI DAT (moi thiet bi/mailbox):
'   1. Import CampaignTracker.bas (da co Sub ArchiveOldCampaignSentItems)
'      vao VBA Project cua Outlook tren may do (Alt+F11 > File > Import
'      File...). Ghi lai TEN MODULE hien trong Project Explorer (vd
'      "Module1" hoac "CampaignTracker" - tuy luc import dat ten gi).
'   2. Trust Center: Outlook > File > Options > Trust Center > Trust
'      Center Settings > Macro Settings > chon "Notifications for all
'      macros" hoac thap hon (macro noi bo da ky/tin cay thi khong can
'      hien canh bao) - script nay goi Application.Run tu ben ngoai,
'      neu Outlook dang chan macro se khong chay duoc.
'   3. Sua dong "MODULE_NAME" ben duoi cho khop dung ten module o buoc 1.
'   4. Test thu cong: double-click file .vbs nay, kiem tra file log tai
'      C:\SHBTrackerLogs\archive-log.txt co dong log moi khong.
'   5. Dang ky Task Scheduler (xem huong dan chi tiet trong
'      tools/TaskScheduler-Setup.txt di kem) - tro Action toi:
'        Program/script : wscript.exe
'        Arguments      : "C:\duong-dan-toi\RunArchiveTask.vbs"
'      Trigger: lap lai moi 12 tieng, bat dau tu thoi diem bat ky.
' ================================================================

Dim MODULE_NAME
MODULE_NAME = "Module2" ' <-- DOI cho khop ten module thuc te tren may nay (module chua ArchiveModule.bas)

Dim outlookApp
On Error Resume Next
Set outlookApp = GetObject(, "Outlook.Application")
If outlookApp Is Nothing Then
    Set outlookApp = CreateObject("Outlook.Application")
    ' Cho Outlook khoi dong xong truoc khi goi macro
    WScript.Sleep 8000
End If
On Error Goto 0

If outlookApp Is Nothing Then
    WScript.Quit 1
End If

On Error Resume Next
outlookApp.Run MODULE_NAME & ".ArchiveOldCampaignSentItems", True
On Error Goto 0

Set outlookApp = Nothing
