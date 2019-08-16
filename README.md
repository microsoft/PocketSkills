# Getting Started

PocketSkills is an empty web application shell that contains no substantial content on its own.  To use this code for your own application you must make a fork/clone of this repo and fill in the content and host it on your own web server / Azure account.  Here is the easiest way to get started:

1. Fork this repo by clicking the Fork button on the top-right of this project's GitHub page.
2. Create a new Azure account if you don't already have one.  You can get one free at https://azure.microsoft.com/Account/Free
3. In your Azure account portal (https://portal.azure.com), click App Services on the left (with the blue earth-looking icon) and then click Add (the black Plus icon at the top of the new pane).
4. If presented with a choice of marketplace templates, just select the basic Web App from Microsoft, and then click Create.
5. On the new Web App pane that comes up, fill in the name of your web site and click Create.  Remember the name you choose because we will come back to it often.
6. When it has finished being created (usually less than a minute), the App Services pane that you opened in Step 3 will contain your new site.  Select it and open the pane for your new site, and you should see a menu of items such as Overview, Activity Log, Access Control, ... Deployment options, ... Application settings, etc.
7. In your web app's pane select Deployment options and set up a new connection by choosing source GitHub.
8. Authorize Azure to have access to your GitHub account, and select the new project that you created when you forked the code in Step 1.
9. This step might take a minute or two, so you can select Deployment options again and watch the spinning wheel until it's complete.
10. When it's done, you should be able to go to https://YOURSTEP5NAMEHERE.azurewebsites.net and see the PocketSkills logo and web shell attempting to start up, but it won't work yet.  You can open your web browser's debugger (usually by pressing F12) at this point to see the Live ID authentication error that's happening, or you can just keep following along with these steps to fix it.
11. To fix the Live ID authentication error, you need to register your new web app with Microsoft Live.  You can skip to step 24 if you plan on using some other form of authentication (such as Google or Facebook or implementing your own).
12. Go to https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade (sign in with the same account you signed in with on Step 2 if prompted).
13. Click New registration, and give it a name (can be the same name as in step 5).
14. If you want to let users outside your organization use the app, then under Supported account types choose the 3rd option which includes "and personal Microsoft accounts (e.g. Skype, Xbox)".
15. Under Redirect URI add this URL next to where it says Web: https://YOURSTEP5NAMEHERE.azurewebsites.net/wlcallback.html
16. Click the blue Register button.
17. When registration is complete, a new page will appear with several IDs.  Copy the Application (client) ID somewhere as you will use it again in several places later.
18. Click Authentication on the left, and find the two checkboxes under Implicit grant named Access tokens and ID tokens.  Check both boxes and click Save.
19. At this point we're going to edit some code.  If you haven't already, either clone your new forked repo to your local disk or use the inline web-based editor on GitHub to open index.html for editing (https://github.com/YOURNAME/YOURFORK/edit/master/PocketSkills/index.html).
20. Find and replace all occurrences of f1c182b7-95db-42f7-bc6f-56dc9e073380 with the Application ID you copied in step 17.  If you're using the web editor, scroll to the bottom and click the green Commit changes button.
21. Repeat step 19 and 20 in Scripts/main.js as well (https://github.com/YOURNAME/YOURFORK/edit/master/PocketSkills/Scripts/main.js).
22. If you cloned and edited the files on your local hard disk, commit and push the changes to your repository on GitHub, and Azure will update your web site automatically within a couple minutes (because of the linking you did in step 8).
23. At this point in a few minutes you should be able to refresh your web site at https://YOURSTEP5NAMEHERE.azurewebsites.net and sign in with any Live ID, but the web site still won't work yet because we haven't created the database that contains data on the back-end.
24. To create the database tables and resoruces that the app will use, go to https://portal.azure.com/#blade/HubsExtension/BrowseResourceBlade/resourceType/Microsoft.Storage%2FStorageAccounts (sign in the same account you signed in with on Step 2 if prompted).
25. Click the Add button on the top of the page.
26. Give the new storage account a name and remember it for later steps.  And it's recommended that you assign it to the same Resource Group and Location the App Service you created in Step 4.
27. Click Create/Review+Create, create the storage account and wait for it to be deployed (can take around 5-10 minutes). When the storage account is created, click on the blue Go to resource button.
28. In the new Storage account, click the Access keys button in the middle pane and copy one of the Connection strings (starting with DefaultEndpointsProtocol...) for use in later steps.
29. Click on the Storage Explorer button in the middle pane, and you should see a new screen appear with Blob Containers, File Shares, Queues, and Tables.
30. Right-click on Blob Containers and create a new container called media with Blob (anonymous read access for blobs only) access.
31. Right-click on Tables and create a new table called codes.
32. Right-click on Tables and create a new table called data.
33. Right-click on Tables and create a new table called notes.
34. Right-click on Tables and create a new table called calendar.
35. Right-click on Tables and create a new table called diarycards.
36. Right-click on Tables and create a new table called logs.
37. Right-click on Tables and create a new table called content.
38. Expand the Tables if not expanded alread, and right-click on the content table you just created and click Get Shared Access Signature.
39. Give the new Shared Access Signature a fairly long lifetime (i.e. 100 years) with Query access only and click Create.
40. Copy the URL for use in later steps.
41. In the Azure portal go to the App Service you created in Step 4, then click on Configuration in the middle pane.
42. Click on New application setting, name it MediaLocation, and set the value to https://YOURSTEP26NAMEHERE.blob.core.windows.net/media
43. Click on New application setting, name it StorageAccount, and paste in the Connection String that you copied in step 28.
44. Click on New application setting, name it ContentSAS, and paste in the Shared Access Signature URL that you copied in step 40.
45. Scroll up and click the blue Save button.


# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
