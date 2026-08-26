Option Explicit

' ================================================================
' SHB CM Archive Module v1.6
' Module VBA RIENG, DOC LAP hoan toan voi CampaignTracker.bas (Module1) -
' khong dung chung bien/hang so nao voi Module1, chi doc UserProperty
' "CMSlug" da duoc CampaignTracker.bas gan san vao mail luc gui (SendCampaign).
'
' CACH IMPORT (VBA Editor - Alt+F11):
'   File > Import File... > chon file ArchiveModule.bas nay.
'   Se tao ra 1 module MOI (thuong ten "ArchiveModule") tach biet voi
'   Module1 - khong can dan de vao Module1.
'
' Chi chuyen cac mail DA GUI QUA CampaignTracker.bas (nhan dien qua
' UserProperty CMSlug) va DA QUA ARCHIVE_AFTER_HOURS ke tu luc gui, tu
' Sent Items sang folder Archive chi dinh (sua ARCHIVE_STORE_NAME/
' ARCHIVE_FOLDER_NAME ben duoi cho khop ten hien tren may ban neu can -
' xem qua Data File Properties > Filename de xac nhan dung store).
'
' v1.2: Quet Sent Items cua TAT CA account trong profile (Application.
' Session.Accounts), khong chi rieng account mac dinh - vi profile co
' the co nhieu account cung luc va campaign co the gui tu account nao
' cung duoc, trong khi GetDefaultFolder(olFolderSentMail) truoc day chi
' tra ve Sent Items cua 1 account mac dinh duy nhat.
'
' v1.3: Doi dich lay theo folder "Muc da Gui" trong PST Archives (khong
' phai folder "Archive" chung chung nhu truoc) - vi PST nay dung ten
' tieng Viet cho folder tuong duong Sent Items, khong co folder ten
' "Sent Items" rieng. Ben trong "Muc da Gui" nay, tu dong tao/dung 1
' subfolder RIENG cho tung account gui (dat ten theo dia chi email cua
' account) - mail tu account nao thi ve dung subfolder cua account do,
' khong con don chung vao 1 cho.
'
' 2 macro chinh:
'   - ArchiveNow() : khong tham so, gan vao nut Ribbon/Quick Access
'     Toolbar - bam la hoi xac nhan roi chay Archive NGAY LAP TUC cho TAT CA
'     mail campaign (gui qua macro), KE CA mail vua gui chua du 24 gio -
'     bo qua han ARCHIVE_AFTER_HOURS vi day la thao tac nguoi dung chu dong
'     bam, khac voi ban chay ngam theo lich (van gioi han 24h nhu binh
'     thuong). Hien MsgBox ket qua.
'   - ArchiveOldCampaignSentItems(Silent) : Silent:=True (mac dinh) chay
'     im lang khong MsgBox, chi ghi log ra file text, CHI chuyen mail da
'     qua ARCHIVE_AFTER_HOURS.
'
' v1.4: THAY THE HOAN TOAN Windows Task Scheduler + script .vbs ben ngoai
' (qua phuc tap de cai lap lai tren nhieu may) bang Windows Timer chay
' NGAM TRONG CHINH VBA - giong het co che tu dong rut gon Sent Items da
' co san trong CampaignTracker.bas (SetTimer/KillTimer qua user32).
' Chi can IMPORT DUY NHAT file .bas nay + dan 1 dong goi StartArchiveAutoTimer
' vao ThisOutlookSession (Application_Startup) la xong - KHONG can Task
' Scheduler, KHONG can biet duong dan file .vbs, KHONG can lap lai tung
' buoc phuc tap tren moi may.
' Xem huong dan chi tiet ngay tren StartArchiveAutoTimer() ben duoi.
' ================================================================

Private Const ARCHIVE_AFTER_HOURS As Long = 24
Private Const ARCHIVE_STORE_NAME  As String = "Archives"
Private Const ARCHIVE_FOLDER_NAME As String = "Mục đã Gửi"
Private Const ARCHIVE_LOG_PATH    As String = "C:\SHBTrackerLogs\archive-log.txt"

' ================================================================
' WINDOWS TIMER - chay ngam de tu dong goi ArchiveOldCampaignSentItems
' moi 3 tieng, khong can Task Scheduler, khong can Outlook Reminder/popup.
' ================================================================
#If VBA7 Then
    Private Declare PtrSafe Function SetTimer Lib "user32" _
        (ByVal hwnd As LongPtr, ByVal nIDEvent As LongPtr, ByVal uElapse As Long, ByVal lpTimerFunc As LongPtr) As LongPtr
    Private Declare PtrSafe Function KillTimer Lib "user32" _
        (ByVal hwnd As LongPtr, ByVal nIDEvent As LongPtr) As Long
#Else
    Private Declare Function SetTimer Lib "user32" _
        (ByVal hwnd As Long, ByVal nIDEvent As Long, ByVal uElapse As Long, ByVal lpTimerFunc As Long) As Long
    Private Declare Function KillTimer Lib "user32" _
        (ByVal hwnd As Long, ByVal nIDEvent As Long) As Long
#End If

Private Const ARCHIVE_TIMER_ID As Long = 918274 ' khac ID voi timer Shrink ben Module1
Private Const ARCHIVE_TIMER_INTERVAL_MS As Long = 10800000 ' 3 tieng (3*60*60*1000ms)

' ================================================================
' CACH CAI (CHI 2 BUOC, LAP LAI TREN MOI MAY):
'   1. Import file ArchiveModule.bas nay (File > Import File...) - VBA
'      se tu tao 1 module moi (vd Module2, ArchiveModule... tuy may).
'   2. Mo ThisOutlookSession (Alt+F11 > Microsoft Outlook Objects >
'      ThisOutlookSession) - neu da co San Sub Application_Startup thi
'      chi them 1 dong goi ben trong; neu chua co, dan nguyen doan sau:
'
'      Private Sub Application_Startup()
'          Call Module2.StartArchiveAutoTimer  ' doi "Module2" thanh
'      End Sub                                  ' dung ten module o buoc 1
'
'   Xong - moi lan mo Outlook, timer se tu bat, cu moi 3 tieng tu goi
'   Archive 1 lan, hoan toan ngam, khong popup, khong can Task Scheduler,
'   khong can biet duong dan file gi ca.
'
'   LUU Y: timer chi song trong luc Outlook dang mo (giong Windows
'   Reminder/Task Scheduler binh thuong cung can may dang bat). Neu dong
'   Outlook, lan mo lai tiep theo se tu bat lai tu dau - khong sao vi
'   ArchiveOldCampaignSentItems tu kiem tra tuoi tung mail (SentOn) chu
'   khong dua vao "da doi du 3 tieng chua", nen du timer bi ngat quang
'   thi lan chay tiep theo van archive dung cac mail da qua 24 gio.
' ================================================================
Public Sub StartArchiveAutoTimer()
    On Error Resume Next
#If VBA7 Then
    Dim h As LongPtr
#Else
    Dim h As Long
#End If
    h = SetTimer(0, ARCHIVE_TIMER_ID, ARCHIVE_TIMER_INTERVAL_MS, AddressOf ArchiveTimerProc)
    On Error GoTo 0
End Sub

Public Sub StopArchiveAutoTimer()
    On Error Resume Next
    KillTimer 0, ARCHIVE_TIMER_ID
    On Error GoTo 0
End Sub

#If VBA7 Then
Public Sub ArchiveTimerProc(ByVal hwnd As LongPtr, ByVal uMsg As Long, ByVal nIDEvent As LongPtr, ByVal dwTimer As Long)
#Else
Public Sub ArchiveTimerProc(ByVal hwnd As Long, ByVal uMsg As Long, ByVal nIDEvent As Long, ByVal dwTimer As Long)
#End If
    On Error Resume Next
    ArchiveOldCampaignSentItems True
    On Error GoTo 0
End Sub

Public Sub ArchiveNow()
    Dim ans As Integer
    ans = MsgBox("Chuyen NGAY TAT CA mail campaign (gui qua macro) tu Sent Items sang " & _
              ARCHIVE_STORE_NAME & " > " & ARCHIVE_FOLDER_NAME & _
              " - ke ca mail vua gui chua du " & ARCHIVE_AFTER_HOURS & " gio?", _
              vbYesNo + vbQuestion, "SHB Tracker - Archive Now")
    If ans = vbNo Then Exit Sub

    ArchiveCampaignSentItems False, True
End Sub

Public Sub ArchiveOldCampaignSentItems(Optional ByVal Silent As Boolean = True)
    ArchiveCampaignSentItems Silent, False
End Sub

' Quet Sent Items cua TAT CA account dang co trong profile Outlook hien
' tai (khong chi rieng account mac dinh) - vi GetDefaultFolder(olFolderSentMail)
' chi tra ve Sent Items cua 1 account MAC DINH duy nhat, trong khi profile
' co the co nhieu account cung luc (vd dung.ha4@shb.com.vn va
' CCE_PROJECT@shb.com.vn) va campaign co the gui tu bat ky account nao.
' Dedup theo StoreID de khong quet trung 1 store 2 lan (truong hop nhieu
' account tro chung 1 mailbox/delivery store).
Private Sub ArchiveCampaignSentItems(ByVal Silent As Boolean, ByVal IgnoreAge As Boolean)
    Dim findDiag As String
    findDiag = ""
    Dim targetFolder As Object
    Set targetFolder = FindArchiveTargetFolder(findDiag)
    If targetFolder Is Nothing Then
        LogArchiveRun "Loi: khong tim thay folder Archive dich. " & findDiag
        If Not Silent Then
            MsgBox "Khong tim thay folder Archive dich (" & ARCHIVE_STORE_NAME & " > " & _
                   ARCHIVE_FOLDER_NAME & ")." & vbCrLf & findDiag, vbExclamation, "SHB Tracker - Archive"
        End If
        Exit Sub
    End If

    Dim cutoff As Date
    cutoff = Now - (ARCHIVE_AFTER_HOURS / 24#)
    Dim moved As Long
    moved = 0
    Dim failed As Long
    failed = 0
    Dim scanned As Long
    scanned = 0
    Dim accountsScanned As Long
    accountsScanned = 0

    Dim seenStoreIDs As String
    seenStoreIDs = "|"

    Dim acc As Object
    Dim store As Object
    Dim sentFolder As Object
    Dim storeID As String
    For Each acc In Application.Session.Accounts
        On Error Resume Next
        Set store = Nothing
        Set store = acc.DeliveryStore
        On Error GoTo 0
        If Not store Is Nothing Then
            storeID = ""
            On Error Resume Next
            storeID = store.StoreID
            On Error GoTo 0
            If Len(storeID) > 0 And InStr(seenStoreIDs, "|" & storeID & "|") = 0 Then
                seenStoreIDs = seenStoreIDs & storeID & "|"

                Set sentFolder = Nothing
                On Error Resume Next
                Set sentFolder = store.GetDefaultFolder(olFolderSentMail)
                On Error GoTo 0

                If Not sentFolder Is Nothing Then
                    accountsScanned = accountsScanned + 1

                    ' Ten subfolder rieng cho account nay ben trong targetFolder -
                    ' uu tien dia chi email (acc.SmtpAddress), neu khong lay
                    ' duoc thi dung DisplayName lam ten thay the.
                    Dim accName As String
                    accName = ""
                    On Error Resume Next
                    accName = acc.SmtpAddress
                    On Error GoTo 0
                    If Len(Trim(accName)) = 0 Then
                        On Error Resume Next
                        accName = acc.DisplayName
                        On Error GoTo 0
                    End If
                    If Len(Trim(accName)) = 0 Then accName = "Khac"

                    Dim accFolder As Object
                    Set accFolder = GetOrCreateSubfolder(targetFolder, accName)
                    If accFolder Is Nothing Then Set accFolder = targetFolder

                    Dim i As Long
                    Dim itm As Object
                    Dim itmSlug As String
                    Dim hasSlug As Boolean
                    For i = sentFolder.Items.Count To 1 Step -1
                        Set itm = sentFolder.Items(i)
                        If TypeName(itm) = "MailItem" Then
                            itmSlug = ""
                            On Error Resume Next
                            Err.Clear
                            itmSlug = itm.UserProperties("CMSlug").Value
                            hasSlug = (Err.Number = 0 And Len(itmSlug) > 0)
                            On Error GoTo 0

                            If hasSlug Then
                                scanned = scanned + 1
                                If IgnoreAge Or itm.SentOn <= cutoff Then
                                    On Error Resume Next
                                    Err.Clear
                                    itm.Move accFolder
                                    If Err.Number = 0 Then
                                        moved = moved + 1
                                    Else
                                        failed = failed + 1
                                    End If
                                    On Error GoTo 0
                                End If
                            End If
                        End If
                    Next i
                End If
            End If
        End If
    Next acc

    Dim summary As String
    summary = Format(Now, "yyyy-mm-dd HH:nn:ss") & " - Quet " & accountsScanned & " account | " & scanned & _
              " mail campaign trong Sent Items | Da chuyen: " & moved & _
              " | Loi: " & failed & " | Nguong: " & IIf(IgnoreAge, "Bo qua (ArchiveNow)", ARCHIVE_AFTER_HOURS & "h")
    LogArchiveRun summary

    If Not Silent Then
        MsgBox "Hoan thanh Archive!" & vbCrLf & "Da quet: " & accountsScanned & " account" & vbCrLf & _
               "Da chuyen: " & moved & vbCrLf & "Loi: " & failed, _
               vbInformation, "SHB Tracker - Archive"
    End If
End Sub

' Bo dau tieng Viet + chuyen thuong, chi dung ky tu ASCII - de so sanh
' ten folder an toan ke ca khi ARCHIVE_FOLDER_NAME (co dau) bi hong dau
' luc copy/paste qua nhieu lop (da tung gap truong hop tuong tu voi
' comment truoc day) - luc do van con nhan dien duoc qua ban khong dau.
Private Function NormalizeVN(ByVal s As String) As String
    Dim r As String
    r = LCase(s)
    r = Replace(Replace(Replace(Replace(Replace(r, "à", "a"), "á", "a"), "ạ", "a"), "ả", "a"), "ã", "a")
    r = Replace(Replace(Replace(Replace(Replace(r, "â", "a"), "ầ", "a"), "ấ", "a"), "ậ", "a"), "ẩ", "a")
    r = Replace(r, "ẫ", "a")
    r = Replace(Replace(Replace(Replace(Replace(r, "ă", "a"), "ằ", "a"), "ắ", "a"), "ặ", "a"), "ẳ", "a")
    r = Replace(r, "ẵ", "a")
    r = Replace(Replace(Replace(Replace(Replace(r, "è", "e"), "é", "e"), "ẹ", "e"), "ẻ", "e"), "ẽ", "e")
    r = Replace(Replace(Replace(Replace(Replace(r, "ê", "e"), "ề", "e"), "ế", "e"), "ệ", "e"), "ể", "e")
    r = Replace(r, "ễ", "e")
    r = Replace(Replace(Replace(Replace(Replace(r, "ì", "i"), "í", "i"), "ị", "i"), "ỉ", "i"), "ĩ", "i")
    r = Replace(Replace(Replace(Replace(Replace(r, "ò", "o"), "ó", "o"), "ọ", "o"), "ỏ", "o"), "õ", "o")
    r = Replace(Replace(Replace(Replace(Replace(r, "ô", "o"), "ồ", "o"), "ố", "o"), "ộ", "o"), "ổ", "o")
    r = Replace(r, "ỗ", "o")
    r = Replace(Replace(Replace(Replace(Replace(r, "ơ", "o"), "ờ", "o"), "ớ", "o"), "ợ", "o"), "ở", "o")
    r = Replace(r, "ỡ", "o")
    r = Replace(Replace(Replace(Replace(Replace(r, "ù", "u"), "ú", "u"), "ụ", "u"), "ủ", "u"), "ũ", "u")
    r = Replace(Replace(Replace(Replace(Replace(r, "ư", "u"), "ừ", "u"), "ứ", "u"), "ự", "u"), "ử", "u")
    r = Replace(r, "ữ", "u")
    r = Replace(Replace(Replace(Replace(Replace(r, "ỳ", "y"), "ý", "y"), "ỵ", "y"), "ỷ", "y"), "ỹ", "y")
    r = Replace(r, "đ", "d")
    NormalizeVN = r
End Function

Private Function FindArchiveTargetFolder(ByRef diag As String) As Object
    Dim fld As Object
    On Error Resume Next
    Set fld = Application.Session.Folders(ARCHIVE_STORE_NAME).Folders(ARCHIVE_FOLDER_NAME)
    On Error GoTo 0
    If Not fld Is Nothing Then
        Set FindArchiveTargetFolder = fld
        Exit Function
    End If

    Dim topFld As Object
    Dim sub1 As Object
    Dim namesTried As String
    namesTried = ""
    For Each topFld In Application.Session.Folders
        namesTried = namesTried & "[" & topFld.Name & "] "
        If InStr(LCase(topFld.Name), "archiv") > 0 Then
            For Each sub1 In topFld.Folders
                If InStr(NormalizeVN(sub1.Name), "da gui") > 0 Or _
                   InStr(LCase(sub1.Name), "sent items") > 0 Then
                    Set FindArchiveTargetFolder = sub1
                    Exit Function
                End If
            Next sub1
            For Each sub1 In topFld.Folders
                If InStr(LCase(sub1.Name), "archiv") > 0 Then
                    Set FindArchiveTargetFolder = sub1
                    Exit Function
                End If
            Next sub1
            Set FindArchiveTargetFolder = topFld
            Exit Function
        End If
    Next topFld

    diag = "Cac store hien co: " & namesTried
    Set FindArchiveTargetFolder = Nothing
End Function

' Tra ve subfolder ten "accName" ben trong "parentFld" - tao moi neu chua co.
Private Function GetOrCreateSubfolder(parentFld As Object, ByVal accName As String) As Object
    Dim f As Object
    On Error Resume Next
    Set f = parentFld.Folders(accName)
    On Error GoTo 0
    If f Is Nothing Then
        On Error Resume Next
        Set f = parentFld.Folders.Add(accName)
        On Error GoTo 0
    End If
    Set GetOrCreateSubfolder = f
End Function

Private Sub LogArchiveRun(ByVal logLine As String)
    On Error Resume Next
    Dim dirPath As String
    dirPath = Left(ARCHIVE_LOG_PATH, InStrRev(ARCHIVE_LOG_PATH, "\") - 1)
    If Len(Dir(dirPath, vbDirectory)) = 0 Then MkDir dirPath

    Dim f As Integer
    f = FreeFile
    Open ARCHIVE_LOG_PATH For Append As #f
    Print #f, logLine
    Close #f
    On Error GoTo 0
End Sub
