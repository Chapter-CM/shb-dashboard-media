Option Explicit

' ================================================================
' SHB CM Archive Module v1.2
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
' 2 macro:
'   - ArchiveNow() : khong tham so, gan vao nut Ribbon/Quick Access
'     Toolbar - bam la hoi xac nhan roi chay Archive NGAY LAP TUC cho TAT CA
'     mail campaign (gui qua macro), KE CA mail vua gui chua du 24 gio -
'     bo qua han ARCHIVE_AFTER_HOURS vi day la thao tac nguoi dung chu dong
'     bam, khac voi ban chay ngam theo lich (van gioi han 24h nhu binh
'     thuong). Hien MsgBox ket qua.
'   - ArchiveOldCampaignSentItems(Silent) : Silent:=True (mac dinh) chay
'     im lang khong MsgBox, chi ghi log ra file text, CHI chuyen mail da
'     qua ARCHIVE_AFTER_HOURS - dung cho Windows Task Scheduler goi dinh
'     ky 12 tieng/lan qua script COM ben ngoai (xem tools/RunArchiveTask.vbs,
'     sua MODULE_NAME thanh "ArchiveModule").
' ================================================================

Private Const ARCHIVE_AFTER_HOURS As Long = 24
Private Const ARCHIVE_STORE_NAME  As String = "Archives"
Private Const ARCHIVE_FOLDER_NAME As String = "Archive"
Private Const ARCHIVE_LOG_PATH    As String = "C:\SHBTrackerLogs\archive-log.txt"

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
                                    itm.Move targetFolder
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
