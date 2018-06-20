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
11. To fix the Live ID authentication error, you need to register your new web app with Microsoft Live.  You can skip to step 20 if you plan on using some other form of authentication (such as Google or Facebook or implementing your own).
12. Go to https://apps.dev.microsoft.com and sign in with the same account you signed in with on Step 2. It's not technically necessary to use the exact same account here but it will help to keep things consistent and prevent confusion later.
13. Click Add an App, then Add Platform, then add this URL: https://YOURSTEP5NAMEHERE.azurewebsites.net/wlcallback.html
14. Scroll up on the page to find the Application ID (it looks like a GUID) and copy it to use it later in steps 16 and 17.
15. At this point we're going to edit some code.  If you haven't already, either clone your new forked repo to your local disk or use the inline web-based editor on GitHub to open index.html for editing (https://github.com/YOURNAME/YOURFORK/edit/master/PocketSkills/index.html).
16. Find and replace all occurrences of f1c182b7-95db-42f7-bc6f-56dc9e073380 with the Application ID you copied in step 14.
17. Repeat step 15 and 16 in Scripts/main.js as well (https://github.com/YOURNAME/YOURFORK/edit/master/PocketSkills/Scripts/main.js).
18. Commit and push the changes to your repository on GitHub, and Azure will update your web site automatically within a couple minutes (because of the linking you did in step 8).
19. At this point you should be able to refresh your web site at https://YOURSTEP5NAMEHERE.azurewebsites.net and sign in with any Live ID, but the web site still won't work yet.  Again, you can open your web browser's debugger (usually by pressing F12) at this point to see the Server.cshtml error that's happening, or you can just keep following along with these steps to fix it.
20. TODO: Continue this documentation.

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
